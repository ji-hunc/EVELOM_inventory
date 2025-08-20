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
import AddProductModal from "@/components/AddProductModal";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [showImages, setShowImages] = useState(false);
  const [viewMode, setViewMode] = useState<
    "current" | "monthly" | "transactions"
  >("current");
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

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

  const loadInitialData = async () => {
    try {
      setIsDataLoading(true);

      const response = await fetch("/api/inventory");
      if (!response.ok) {
        throw new Error("Failed to load data");
      }

      const { data } = await response.json();

      setLocations(data.locations);
      setCategories(data.categories);
      setProducts(data.products);
      setInventory(data.inventory);

      // 창고를 기본 선택 (없으면 첫 번째 위치)
      if (data.locations && data.locations.length > 0) {
        const warehouse = data.locations.find((loc) => loc.name === "창고");
        setSelectedLocation(warehouse?.id || data.locations[0].id);
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
    (loc) => loc.id === selectedLocation
  );

  // 전체 탭인 경우와 개별 위치인 경우 구분
  const isAllSelected = selectedLocation === "all";
  const filteredInventory = isAllSelected
    ? inventory
    : inventory.filter((item) => item.location_id === selectedLocation);

  // 전체 탭인 경우 제품별로 그룹화해서 총합 계산
  const aggregatedInventory = isAllSelected
    ? inventory.reduce((acc, item) => {
        const existing = acc.find((agg) => agg.product_id === item.product_id);
        if (existing) {
          existing.current_stock += item.current_stock;
        } else {
          acc.push({
            ...item,
            id: item.product_id, // 유니크 키로 사용
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
        showImages={showImages}
        onToggleImages={() => setShowImages(!showImages)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow">
          <LocationTabs
            locations={locations}
            selectedLocation={selectedLocation}
            onLocationSelect={setSelectedLocation}
            inventory={inventory}
          />

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isAllSelected ? "전체 위치" : selectedLocationData?.name} 재고
                현황
              </h2>
              <div className="flex items-center justify-between">
                <p className="text-gray-600">
                  총 {aggregatedInventory.length}개 품목, 총 재고:{" "}
                  {aggregatedInventory.reduce(
                    (sum, item) => sum + item.current_stock,
                    0
                  )}
                  개
                  {isAllSelected && (
                    <span className="ml-2 text-sm text-gray-500">
                      (모든 위치 재고 합계)
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-4">
                  {user.role === "master" && (
                    <button
                      onClick={() => setShowAddProductModal(true)}
                      className="btn-primary"
                    >
                      + 새 제품 추가
                    </button>
                  )}
                  <button
                    onClick={() => setShowImages(!showImages)}
                    className={`btn-secondary ${
                      showImages ? "bg-primary-100 text-primary-700" : ""
                    }`}
                  >
                    이미지 {showImages ? "숨기기" : "보기"}
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "current" && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">총 품목 수</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {aggregatedInventory.length}개
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">총 재고량</div>
                    <div className="text-2xl font-bold text-primary-600">
                      {aggregatedInventory.reduce((sum, item) => sum + item.current_stock, 0).toLocaleString()}개
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">재고 부족 품목</div>
                    <div className="text-2xl font-bold text-warning-600">
                      {aggregatedInventory.filter(item => item.current_stock <= user.alert_threshold).length}개
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
                showImages={showImages}
                viewMode={viewMode}
                userRole={user.role}
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
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* 새 제품 추가 모달 */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        categories={categories}
        locations={locations}
        onProductAdded={loadInitialData}
      />
    </div>
  );
}
