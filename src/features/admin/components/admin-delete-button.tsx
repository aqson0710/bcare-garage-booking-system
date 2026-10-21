"use client";

// Shared red "delete" button for the admin edit forms (products, product
// categories, services, service categories). Always asks for confirmation
// before calling onConfirm, so every page deletes the same way.
export function AdminDeleteButton({
  confirmMessage,
  disabled = false,
  isDeleting,
  label,
  onConfirm,
}: {
  confirmMessage: string;
  disabled?: boolean;
  isDeleting: boolean;
  label: string;
  onConfirm: () => void;
}) {
  function handleClick() {
    if (window.confirm(confirmMessage)) {
      onConfirm();
    }
  }

  return (
    <button
      className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || isDeleting}
      onClick={handleClick}
      type="button"
    >
      {isDeleting ? "กำลังลบ..." : label}
    </button>
  );
}
