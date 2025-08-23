"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Location, Category, Product, Inventory } from "@/types";
import Header from "@/components/Header";
import LocationTabs from "@/components/LocationTabs";
import InventoryTable from "@/components/InventoryTable";
import TransactionView from "@/components/TransactionView";
import MonthlyView from "@/components/MonthlyView";
import StockInputModal from "@/components/StockInputModal";
import StockTransferModal from "@/components/StockTransferModal";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [viewMode, setViewMode] = useState<
    "current" | "monthly" | "transactions"
  >("current");
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showStockInputModal, setShowStockInputModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  // 일반 계정의 초기 위치 설정
  useEffect(() => {
    if (
      user &&
      user.role === "general" &&
      user.assigned_location_id &&
      locations.length > 0
    ) {
      setSelectedLocation(user.assigned_location_id);
    }
  }, [user, locations]);

  const loadInitialData = async () => {
    try {
      setIsDataLoading(true);

      console.log("Current user:", user);
      console.log("User ID:", user?.id);

      // 임시 테스트: user가 없으면 테스트 사용자 생성
      if (!user) {
        console.log("No user found, creating test user");

        // URL 쿼리 파라미터로 사용자 타입 결정
        const urlParams = new URLSearchParams(window.location.search);
        const userType = urlParams.get("user") || "general";

        let testUser;
        if (userType === "master") {
          testUser = {
            username: "master_admin",
            role: "master" as const,
            assigned_location_id: null,
            alert_threshold: 30,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } else {
          testUser = {
            username: "청량리_evelom",
            role: "general" as const,
            assigned_location_id: "청량리", // location name 사용
            alert_threshold: 30,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        console.log("Test user created:", testUser);
        localStorage.setItem("evelom-user", JSON.stringify(testUser));
        window.location.reload();
        return;
      }

      // 마스터와 readonly는 전체 데이터 로드, 일반 사용자는 특정 사용자 데이터 로드
      const apiUrl =
        (user.role === "master" || user.role === "readonly")
          ? "/api/inventory"
          : `/api/inventory?userId=${user.username}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error("Failed to load data");
      }

      const { data } = await response.json();

      // 일반 계정은 자신의 위치만 필터링
      let filteredLocations = data.locations;
      let filteredInventory = data.inventory;

      if (user && user.role === "general" && user.assigned_location_id) {
        filteredLocations = data.locations.filter(
          (loc: any) => loc.name === user.assigned_location_id
        );
        filteredInventory = data.inventory.filter(
          (item: any) => item.location_id === user.assigned_location_id
        );
      }

      setLocations(filteredLocations);
      setCategories(data.categories);
      setProducts(data.products);
      setInventory(filteredInventory);

      // 일반 계정은 자신의 할당된 위치만, 마스터는 창고를 기본 선택
      if (filteredLocations && filteredLocations.length > 0 && user) {
        if (user.role === "general" && user.assigned_location_id) {
          setSelectedLocation(user.assigned_location_id);
        } else if (user.role === "master") {
          const warehouse = filteredLocations.find(
            (loc: any) => loc.name === "창고"
          );
          setSelectedLocation(warehouse?.name || filteredLocations[0].name);
        }
      }
    } catch (error) {
      console.error("데이터 로드 중 오류:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  if (isLoading || isDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary-600 text-lg">데이터 로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const selectedLocationData = locations.find(
    (loc) => loc.name === selectedLocation
  );

  // 마스터와 readonly는 전체 탭 사용 가능, 일반 계정은 자신의 위치만
  const isAllSelected = selectedLocation === "all" && (user.role === "master" || user.role === "readonly");
  const filteredInventory = isAllSelected
    ? inventory
    : inventory.filter((item) => item.location_id === selectedLocation);

  // 전체 탭인 경우 제품별+배치코드별로 그룹화해서 총합 계산
  const aggregatedInventory = isAllSelected
    ? inventory.reduce((acc, item) => {
        // 배치코드도 고려해서 유니크한 키 생성
        const key = `${item.product_id}-${item.batch_code || "no-batch"}`;
        const existing = acc.find(
          (agg) =>
            agg.product_id === item.product_id &&
            (agg.batch_code || "no-batch") === (item.batch_code || "no-batch")
        );

        if (existing) {
          existing.current_stock += item.current_stock;
          // 가장 최근 업데이트 날짜로 갱신
          if (new Date(item.last_updated) > new Date(existing.last_updated)) {
            existing.last_updated = item.last_updated;
          }
        } else {
          acc.push({
            ...item,
            id: key, // 유니크 키로 사용
            location_id: "all",
            current_stock: item.current_stock,
          });
        }
        return acc;
      }, [] as Inventory[])
    : filteredInventory;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        user={user}
        onLogout={() => {
          router.push("/");
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow">
          <LocationTabs
            locations={locations}
            selectedLocation={selectedLocation}
            onLocationSelect={setSelectedLocation}
            inventory={inventory}
            user={user}
          />

          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isAllSelected ? "전체 위치" : selectedLocationData?.name} 재고 현황
                </h2>
                <div className="flex items-center gap-3">
                  {user.role !== "readonly" && (
                    <>
                      {user.role === "master" && (
                        <>
                          <button
                            onClick={() => setShowStockInputModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-sm font-medium rounded-md hover:from-yellow-500 hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 shadow-md transition-all duration-200"
                          >
                            + 재고 입력
                          </button>
                          <button
                            onClick={() => setShowStockTransferModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white text-sm font-medium rounded-md hover:from-amber-500 hover:to-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 shadow-md transition-all duration-200"
                          >
                            재고 이동
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {user.role === "readonly" && (
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-md">
                      📖 읽기 전용 모드
                    </div>
                  )}
                </div>
              </div>
            </div>

            {viewMode === "current" && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      총 품목 수
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {aggregatedInventory.length}개
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      총 재고량
                    </div>
                    <div className="text-2xl font-bold text-primary-600">
                      {aggregatedInventory
                        .reduce((sum, item) => sum + item.current_stock, 0)
                        .toLocaleString()}
                      개
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      재고 부족 품목
                    </div>
                    <div className="text-2xl font-bold text-warning-600">
                      {
                        aggregatedInventory.filter(
                          (item) => item.current_stock <= user.alert_threshold
                        ).length
                      }
                      개
                    </div>
                  </div>
                </div>
              </div>
            )}

            {viewMode === "current" ? (
              <InventoryTable
                inventory={aggregatedInventory}
                categories={categories}
                products={products}
                locations={locations}
                viewMode={viewMode}
                user={user}
                alertThreshold={user.alert_threshold}
                onInventoryUpdate={loadInitialData}
                selectedLocation={selectedLocation}
                isAllSelected={isAllSelected}
              />
            ) : viewMode === "transactions" ? (
              <TransactionView
                selectedLocation={selectedLocation}
                products={products}
                locations={locations}
                categories={categories}
              />
            ) : viewMode === "monthly" ? (
              <MonthlyView
                selectedLocation={selectedLocation}
                products={products}
                locations={locations}
                categories={categories}
                inventory={aggregatedInventory}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* 재고 입력 모달 */}
      <StockInputModal
        isOpen={showStockInputModal}
        onClose={() => setShowStockInputModal(false)}
        products={products}
        locations={locations}
        onStockAdded={loadInitialData}
      />

      {/* 재고 이동 모달 */}
      <StockTransferModal
        isOpen={showStockTransferModal}
        onClose={() => setShowStockTransferModal(false)}
        products={products}
        locations={locations}
        inventory={inventory}
        onTransferCompleted={loadInitialData}
      />
    </div>
  );
}
