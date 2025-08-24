"use client";

import { useState } from "react";
import { User } from "@/types";
import { LogOut, User as UserIcon, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import SettingsModal from "./SettingsModal";

interface HeaderProps {
  user: User;
  onLogout: () => void;
  viewMode: "current" | "monthly" | "transactions";
  onViewModeChange: (mode: "current" | "monthly" | "transactions") => void;
  showImages?: boolean;
  onToggleImages?: () => void;
}

export default function Header({
  user,
  onLogout,
  viewMode,
  onViewModeChange,
  showImages,
  onToggleImages,
}: HeaderProps) {
  const { logout, updateUser } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleSettingsUpdate = (updatedUser: User) => {
    updateUser(updatedUser);
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">EVELOM</h1>
              <span className="ml-2 text-sm text-gray-500">
                재고관리 시스템
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                재고관리
              </Link>
              {(user.role === "master" || user.role === "readonly") && (
                <Link
                  href="/products"
                  className="text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
                >
                  제품관리
                </Link>
              )}
              {/* <Link 
                href="/stats"
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                통계
              </Link> */}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* 뷰 모드 선택 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange("current")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "current"
                    ? "bg-primary-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                현재고
              </button>
              <button
                onClick={() => onViewModeChange("monthly")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "monthly"
                    ? "bg-primary-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                월간현황
              </button>
              <button
                onClick={() => onViewModeChange("transactions")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "transactions"
                    ? "bg-primary-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                입출고내역
              </button>
            </div>

            {/* 사용자 정보 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{user.username}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === "master"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {user.role === "master" ? "마스터" : "일반"}
                </span>
                {user.location && (
                  <span className="text-gray-500">({user.location})</span>
                )}
              </div>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Settings className="w-4 h-4" />
                설정
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onSettingsUpdate={handleSettingsUpdate}
      />
    </header>
  );
}
