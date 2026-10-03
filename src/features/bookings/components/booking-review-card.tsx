"use client";

import { useEffect, useState } from "react";
import { StarRatingDisplay, StarRatingInput } from "@/components/star-rating";
import { createClient } from "@/lib/supabase/browser";
import { getBookingReview, saveBookingReview } from "../queries";
import type { MyBooking, ServiceReview } from "../types";

type ReviewState =
  | { status: "loading" }
  | { status: "ready"; review: ServiceReview | null }
  | { status: "error"; message: string };

const maxCommentLength = 1000;

// Shown on the customer's booking page once the repair is completed:
// rate the service 1-5 stars with an optional comment, and edit it later.
export function BookingReviewCard({ booking }: { booking: MyBooking }) {
  const [reviewState, setReviewState] = useState<ReviewState>({
    status: "loading",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getBookingReview(createClient(), booking.id).then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setReviewState({
          message: "ยังโหลดรีวิวไม่ได้ ลองรีเฟรชหน้านี้อีกครั้ง",
          status: "error",
        });
        return;
      }

      setReviewState({ review: data, status: "ready" });
      setRating(data?.rating ?? 0);
      setComment(data?.comment ?? "");
      setIsEditing(!data);
    });

    return () => {
      isMounted = false;
    };
  }, [booking.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1) {
      setSaveError("กรุณาเลือกคะแนน 1-5 ดาว");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const { data, error } = await saveBookingReview(createClient(), {
      bookingId: booking.id,
      comment: comment.trim() || null,
      customerId: booking.customer_id,
      rating,
      serviceId: booking.service_id,
    });

    setIsSaving(false);

    if (error || !data) {
      setSaveError("บันทึกรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setReviewState({ review: data, status: "ready" });
    setIsEditing(false);
    setJustSaved(true);
  }

  if (booking.status !== "completed") {
    return null;
  }

  return (
    <article className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--brand)]">
        รีวิวบริการ
      </p>
      <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">
        {reviewState.status === "ready" && reviewState.review && !isEditing
          ? "ขอบคุณสำหรับรีวิว"
          : "งานซ่อมเสร็จแล้ว ให้คะแนนบริการครั้งนี้หน่อยนะครับ"}
      </h2>

      {reviewState.status === "loading" ? (
        <div className="mt-4 h-10 w-56 animate-pulse rounded-md bg-[var(--surface-muted)]" />
      ) : null}

      {reviewState.status === "error" ? (
        <p className="mt-3 text-sm text-red-200">{reviewState.message}</p>
      ) : null}

      {reviewState.status === "ready" && reviewState.review && !isEditing ? (
        <div className="mt-4">
          <StarRatingDisplay rating={reviewState.review.rating} size={20} />
          {reviewState.review.comment ? (
            <p className="mt-3 whitespace-pre-line rounded-md bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--foreground)]">
              {reviewState.review.comment}
            </p>
          ) : null}
          {justSaved ? (
            <p className="mt-3 text-sm text-emerald-200">บันทึกรีวิวแล้ว</p>
          ) : null}
          <button
            className="mt-4 min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)]"
            onClick={() => {
              setIsEditing(true);
              setJustSaved(false);
            }}
            type="button"
          >
            แก้ไขรีวิว
          </button>
        </div>
      ) : null}

      {reviewState.status === "ready" && isEditing ? (
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <StarRatingInput
            disabled={isSaving}
            onChange={setRating}
            value={rating}
          />
          <label className="block text-sm font-semibold text-[var(--foreground)]">
            ความคิดเห็นเพิ่มเติม (ไม่บังคับ)
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              disabled={isSaving}
              maxLength={maxCommentLength}
              onChange={(event) => setComment(event.target.value)}
              placeholder="เช่น ช่างอธิบายปัญหาชัดเจน งานเสร็จตรงเวลา"
              value={comment}
            />
            <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">
              {comment.length}/{maxCommentLength}
            </span>
          </label>
          {saveError ? (
            <p className="text-sm text-red-200">{saveError}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-10 rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--on-brand)] disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "กำลังบันทึก..." : "ส่งรีวิว"}
            </button>
            {reviewState.review ? (
              <button
                className="min-h-10 rounded-md border border-[var(--line)] px-5 text-sm font-semibold text-[var(--muted)]"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setRating(reviewState.review?.rating ?? 0);
                  setComment(reviewState.review?.comment ?? "");
                  setSaveError(null);
                }}
                type="button"
              >
                ยกเลิก
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </article>
  );
}

// Read-only view of a booking's review, for the admin booking popup.
export function BookingReviewSummary({ bookingId }: { bookingId: string }) {
  const [reviewState, setReviewState] = useState<ReviewState>({
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    getBookingReview(createClient(), bookingId).then(({ data, error }) => {
      if (isMounted) {
        setReviewState(
          error
            ? { message: "โหลดรีวิวไม่สำเร็จ", status: "error" }
            : { review: data, status: "ready" },
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  return (
    <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-sm">
      <p className="font-semibold text-[var(--foreground)]">รีวิวจากลูกค้า</p>
      {reviewState.status === "loading" ? (
        <div className="mt-2 h-5 w-40 animate-pulse rounded bg-[var(--surface)]" />
      ) : null}
      {reviewState.status === "error" ? (
        <p className="mt-2 text-red-200">{reviewState.message}</p>
      ) : null}
      {reviewState.status === "ready" && !reviewState.review ? (
        <p className="mt-2 text-[var(--muted)]">ลูกค้ายังไม่ได้รีวิว</p>
      ) : null}
      {reviewState.status === "ready" && reviewState.review ? (
        <div className="mt-2 space-y-2">
          <StarRatingDisplay rating={reviewState.review.rating} />
          {reviewState.review.comment ? (
            <p className="whitespace-pre-line leading-6 text-[var(--muted)]">
              {reviewState.review.comment}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
