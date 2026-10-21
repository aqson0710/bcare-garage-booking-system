"use client";

import {
  createAdminProductCategory,
  deleteAdminProductCategory,
  getAdminProductCategories,
  updateAdminProductCategory,
  type AdminProductCategory,
} from "@/features/admin";
import {
  AdminCategoryManager,
  type AdminCategoryApi,
  type AdminCategoryLabels,
} from "@/features/admin/components/admin-category-manager";

// Defined once at module level so the manager's data loader stays stable.
const productCategoryApi: AdminCategoryApi<AdminProductCategory> = {
  create: createAdminProductCategory,
  list: getAdminProductCategories,
  remove: deleteAdminProductCategory,
  update: updateAdminProductCategory,
};

const productCategoryLabels: AdminCategoryLabels = {
  addDescription: "หมวดใหม่จะถูกนำไปใช้ในตัวเลือกหมวดสินค้าของหลังบ้าน",
  childEntity: "สินค้า",
  childPageHref: "/admin/products",
  entity: "หมวดสินค้า",
  namePlaceholder: "เช่น อะไหล่เครื่องยนต์",
  pageDescription: "จัดการชื่อหมวด รายละเอียด และสถานะการใช้งานของหมวดสินค้า",
};

export function AdminProductCategoriesPanel() {
  return (
    <AdminCategoryManager
      api={productCategoryApi}
      labels={productCategoryLabels}
    />
  );
}
