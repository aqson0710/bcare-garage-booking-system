"use client";

import {
  createAdminServiceCategory,
  deleteAdminServiceCategory,
  getAdminServiceCategories,
  updateAdminServiceCategory,
  type AdminServiceCategory,
} from "@/features/admin";
import {
  AdminCategoryManager,
  type AdminCategoryApi,
  type AdminCategoryLabels,
} from "@/features/admin/components/admin-category-manager";

// Same page as product categories (shared AdminCategoryManager), with the
// service-category data functions and labels.
const serviceCategoryApi: AdminCategoryApi<AdminServiceCategory> = {
  create: createAdminServiceCategory,
  list: getAdminServiceCategories,
  remove: deleteAdminServiceCategory,
  update: updateAdminServiceCategory,
};

const serviceCategoryLabels: AdminCategoryLabels = {
  addDescription: "หมวดใหม่จะถูกนำไปใช้ในตัวเลือกหมวดบริการของหลังบ้านและหน้าจองบริการ",
  childEntity: "บริการ",
  childPageHref: "/admin/services",
  entity: "หมวดบริการ",
  listNote: "หมวดที่ปิดใช้งานจะไม่แสดงในหน้าจองบริการของลูกค้า",
  namePlaceholder: "เช่น ระบบแอร์",
  pageDescription:
    "จัดการชื่อหมวด รายละเอียด และสถานะการแสดงผลของหมวดบริการในหน้าจองลูกค้า",
};

export function AdminServiceCategoriesPanel() {
  return (
    <AdminCategoryManager
      api={serviceCategoryApi}
      labels={serviceCategoryLabels}
    />
  );
}
