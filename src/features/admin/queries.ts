import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/features/auth";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AdminAccessResult,
  AdminBooking,
  AdminBookingListParams,
  AdminBookingStatusAction,
  AdminCustomerBooking,
  AdminCustomerDetail,
  AdminCustomerSummary,
  AdminGarageCapacity,
  AdminGarageCapacityInput,
  AdminGarageClosedDateInput,
  AdminGarageOperatingDayInput,
  AdminInventoryMovement,
  AdminInventoryMovementCreateInput,
  AdminMechanic,
  AdminPaymentSettingUpdateInput,
  AdminProduct,
  AdminProductCategoryCreateInput,
  AdminProductCategoryUpdateInput,
  AdminProductCreateInput,
  AdminProductOrder,
  AdminProductOrderItem,
  AdminProductOrderListParams,
  AdminProductOrderStatusAction,
  AdminProductUpdateInput,
  AdminRepairJob,
  AdminReports,
  AdminScheduleDay,
  AdminScheduleOverview,
  AdminScheduleSlot,
  AdminService,
  AdminServiceCategoryCreateInput,
  AdminServiceCategoryUpdateInput,
  AdminServiceUpdateInput,
  AdminTechnicianSkillCreateInput,
  AdminTechnicianSkillUpdateInput,
  RepairJob,
} from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

const scheduleStartTime = "09:00";
const scheduleEndTime = "18:00";
const scheduleSlotIntervalMinutes = 30;

function getUniqueIds(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeSearchTerm(search: string) {
  return search.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function incrementCount(map: Map<string, number>, id: string) {
  map.set(id, (map.get(id) ?? 0) + 1);
}

function getTopCounts(map: Map<string, number>, limit = 5) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function normalizeSlotTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainingMinutes = String(minutes % 60).padStart(2, "0");

  return `${hours}:${remainingMinutes}`;
}

function getScheduleTimeSlots() {
  const startMinutes = timeToMinutes(scheduleStartTime);
  const endMinutes = timeToMinutes(scheduleEndTime);

  return Array.from(
    {
      length:
        Math.floor((endMinutes - startMinutes) / scheduleSlotIntervalMinutes) +
        1,
    },
    (_, index) => minutesToTime(startMinutes + index * scheduleSlotIntervalMinutes),
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateText: string, dayOffset: number) {
  const nextDate = new Date(`${dateText}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + dayOffset);

  return toDateInputValue(nextDate);
}

function getWeekday(dateText: string) {
  return new Date(`${dateText}T00:00:00`).getDay();
}

function getBookingSlotKey(date: string, time: string) {
  return `${date}|${normalizeSlotTime(time)}`;
}

function attachGarageCapacityUsage(
  capacityRows: Database["public"]["Tables"]["garage_capacity"]["Row"][],
  bookings: Database["public"]["Tables"]["bookings"]["Row"][],
) {
  const activeBookingCounts = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      continue;
    }

    const slotKey = getBookingSlotKey(
      booking.booking_date,
      booking.booking_time,
    );
    activeBookingCounts.set(slotKey, (activeBookingCounts.get(slotKey) ?? 0) + 1);
  }

  return capacityRows.map((capacity) => {
    const activeBookingCount =
      activeBookingCounts.get(
        getBookingSlotKey(capacity.booking_date, capacity.booking_time),
      ) ?? 0;

    return {
      ...capacity,
      activeBookingCount,
      availableBookingCount: Math.max(
        capacity.max_bookings - activeBookingCount,
        0,
      ),
      isOpen: capacity.status === "open" && capacity.max_bookings > activeBookingCount,
    } satisfies AdminGarageCapacity;
  });
}

function buildScheduleOverview(
  startDate: string,
  dayCount: number,
  capacityRows: Database["public"]["Tables"]["garage_capacity"]["Row"][],
  bookings: Database["public"]["Tables"]["bookings"]["Row"][],
  operatingDays: Database["public"]["Tables"]["garage_operating_days"]["Row"][],
  closedDates: Database["public"]["Tables"]["garage_closed_dates"]["Row"][],
) {
  const normalizedDayCount = Math.min(Math.max(dayCount, 1), 14);
  const dates = Array.from({ length: normalizedDayCount }, (_, index) =>
    addDays(startDate, index),
  );
  const timeSlots = getScheduleTimeSlots();
  const capacityBySlot = new Map(
    capacityRows.map((capacity) => [
      getBookingSlotKey(capacity.booking_date, capacity.booking_time),
      capacity,
    ]),
  );
  const operatingDayByWeekday = new Map(
    operatingDays.map((operatingDay) => [operatingDay.weekday, operatingDay]),
  );
  const closedDateByDate = new Map(
    closedDates.map((closedDate) => [closedDate.closed_date, closedDate]),
  );
  const activeBookingCounts = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      continue;
    }

    const slotKey = getBookingSlotKey(
      booking.booking_date,
      booking.booking_time,
    );
    activeBookingCounts.set(slotKey, (activeBookingCounts.get(slotKey) ?? 0) + 1);
  }

  const days = dates.map((bookingDate) => {
    const operatingDay = operatingDayByWeekday.get(getWeekday(bookingDate));
    const isSpecialClosed = closedDateByDate.has(bookingDate);
    const isOperatingDayOpen =
      (operatingDay?.is_open ?? ![0, 6].includes(getWeekday(bookingDate))) &&
      !isSpecialClosed;
    const openTime = normalizeSlotTime(operatingDay?.open_time ?? scheduleStartTime);
    const closeTime = normalizeSlotTime(
      operatingDay?.close_time ?? scheduleEndTime,
    );

    const slots = timeSlots.map((bookingTime) => {
      const slotKey = getBookingSlotKey(bookingDate, bookingTime);
      const capacity = capacityBySlot.get(slotKey);
      const maxBookings = capacity?.max_bookings ?? 1;
      const isWithinOperatingHours =
        bookingTime >= openTime && bookingTime <= closeTime;
      const status =
        isOperatingDayOpen && isWithinOperatingHours
          ? (capacity?.status ?? "open")
          : "closed";
      const activeBookingCount = activeBookingCounts.get(slotKey) ?? 0;

      return {
        activeBookingCount,
        availableBookingCount: Math.max(maxBookings - activeBookingCount, 0),
        bookingDate,
        bookingTime,
        hasCapacityRule: Boolean(capacity),
        isOpen: status === "open" && maxBookings > activeBookingCount,
        maxBookings,
        status,
      } satisfies AdminScheduleSlot;
    });

    return {
      activeBookingCount: slots.reduce(
        (total, slot) => total + slot.activeBookingCount,
        0,
      ),
      availableBookingCount: slots.reduce(
        (total, slot) => total + slot.availableBookingCount,
        0,
      ),
      bookingDate,
      closedSlotCount: slots.filter(
        (slot) => slot.status === "closed" || slot.maxBookings <= 0,
      ).length,
      maxBookings: slots.reduce((total, slot) => total + slot.maxBookings, 0),
      slots,
    } satisfies AdminScheduleDay;
  });

  return {
    days,
    endDate: dates[dates.length - 1],
    startDate,
    timeSlots,
  } satisfies AdminScheduleOverview;
}

async function attachMechanicSkills(
  supabase: BCareSupabaseClient,
  mechanics: Database["public"]["Tables"]["profiles"]["Row"][],
) {
  if (mechanics.length === 0) {
    return {
      data: [] satisfies AdminMechanic[],
      error: null,
    };
  }

  const mechanicIds = mechanics.map((mechanic) => mechanic.id);
  const profileSkillsResult = await supabase
    .from("technician_profile_skills")
    .select("*")
    .in("technician_id", mechanicIds);

  if (profileSkillsResult.error) {
    return {
      data: null,
      error: profileSkillsResult.error,
    };
  }

  const profileSkills = profileSkillsResult.data ?? [];
  const skillIds = getUniqueIds(
    profileSkills.map((profileSkill) => profileSkill.skill_id),
  );
  const skillsResult =
    skillIds.length > 0
      ? await supabase
          .from("technician_skills")
          .select("*")
          .in("id", skillIds)
          .eq("status", "active")
      : { data: [], error: null };

  if (skillsResult.error) {
    return {
      data: null,
      error: skillsResult.error,
    };
  }

  const skillsById = new Map(
    (skillsResult.data ?? []).map((skill) => [skill.id, skill]),
  );
  const skillIdsByMechanicId = new Map<string, string[]>();

  for (const profileSkill of profileSkills) {
    const currentSkillIds =
      skillIdsByMechanicId.get(profileSkill.technician_id) ?? [];
    currentSkillIds.push(profileSkill.skill_id);
    skillIdsByMechanicId.set(profileSkill.technician_id, currentSkillIds);
  }

  return {
    data: mechanics.map((mechanic) => ({
      ...mechanic,
      skills: (skillIdsByMechanicId.get(mechanic.id) ?? [])
        .map((skillId) => skillsById.get(skillId))
        .filter((skill): skill is AdminMechanic["skills"][number] =>
          Boolean(skill),
        ),
    })),
    error: null,
  };
}

async function attachInventoryMovementDetails(
  supabase: BCareSupabaseClient,
  movements: Database["public"]["Tables"]["inventory_movements"]["Row"][],
) {
  const productIds = getUniqueIds(
    movements.map((movement) => movement.product_id),
  );
  const creatorIds = getUniqueIds(
    movements
      .map((movement) => movement.created_by)
      .filter((creatorId): creatorId is string => Boolean(creatorId)),
  );

  const [productsResult, creatorsResult] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("*").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length > 0
      ? supabase.from("profiles").select("*").in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  if (creatorsResult.error) {
    return {
      data: null,
      error: creatorsResult.error,
    };
  }

  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
  );
  const creatorsById = new Map(
    (creatorsResult.data ?? []).map((creator) => [creator.id, creator]),
  );

  return {
    data: movements.map(
      (movement) =>
        ({
          ...movement,
          createdBy: movement.created_by
            ? (creatorsById.get(movement.created_by) ?? null)
            : null,
          product: productsById.get(movement.product_id) ?? null,
        }) satisfies AdminInventoryMovement,
    ),
    error: null,
  };
}

async function attachProductOrderItemsProducts(
  supabase: BCareSupabaseClient,
  orderItems: Database["public"]["Tables"]["product_order_items"]["Row"][],
) {
  const productIds = getUniqueIds(orderItems.map((item) => item.product_id));

  if (productIds.length === 0) {
    return {
      data: [] satisfies AdminProductOrderItem[],
      error: null,
    };
  }

  const productsResult = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  const categoryIds = getUniqueIds(
    (productsResult.data ?? []).map((product) => product.product_category_id),
  );
  const categoriesResult =
    categoryIds.length > 0
      ? await supabase.from("product_categories").select("*").in("id", categoryIds)
      : { data: [], error: null };

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  const categoriesById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [
      product.id,
      {
        ...product,
        category: categoriesById.get(product.product_category_id) ?? null,
      },
    ]),
  );

  return {
    data: orderItems.map((item) => ({
      ...item,
      product: productsById.get(item.product_id) ?? null,
    })) satisfies AdminProductOrderItem[],
    error: null,
  };
}

async function attachAdminProductOrderDetails(
  supabase: BCareSupabaseClient,
  orders: Database["public"]["Tables"]["product_orders"]["Row"][],
) {
  const customerIds = getUniqueIds(orders.map((order) => order.customer_id));
  const orderIds = getUniqueIds(orders.map((order) => order.id));

  const [customersResult, itemsResult, movementsResult, paymentsResult] =
    await Promise.all([
      customerIds.length > 0
        ? supabase.from("profiles").select("*").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("product_order_items")
            .select("*")
            .in("product_order_id", orderIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("inventory_movements")
            .select("*")
            .eq("reference_type", "product_order")
            .in("reference_id", orderIds)
            .in("movement_type", ["sale", "return"])
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("product_payments")
            .select("*")
            .in("product_order_id", orderIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (customersResult.error) {
    return {
      data: null,
      error: customersResult.error,
    };
  }

  if (itemsResult.error) {
    return {
      data: null,
      error: itemsResult.error,
    };
  }

  if (movementsResult.error) {
    return {
      data: null,
      error: movementsResult.error,
    };
  }

  if (paymentsResult.error) {
    return {
      data: null,
      error: paymentsResult.error,
    };
  }

  const itemsWithProductsResult = await attachProductOrderItemsProducts(
    supabase,
    itemsResult.data ?? [],
  );

  if (itemsWithProductsResult.error) {
    return {
      data: null,
      error: itemsWithProductsResult.error,
    };
  }

  const movementsWithDetailsResult = await attachInventoryMovementDetails(
    supabase,
    movementsResult.data ?? [],
  );

  if (movementsWithDetailsResult.error) {
    return {
      data: null,
      error: movementsWithDetailsResult.error,
    };
  }

  const customersById = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const itemsByOrderId = new Map<string, AdminProductOrderItem[]>();
  const movementsByOrderId = new Map<string, AdminInventoryMovement[]>();
  const paymentsByOrderId = new Map<
    string,
    Database["public"]["Tables"]["product_payments"]["Row"][]
  >();

  for (const item of itemsWithProductsResult.data ?? []) {
    const currentItems = itemsByOrderId.get(item.product_order_id) ?? [];
    currentItems.push(item);
    itemsByOrderId.set(item.product_order_id, currentItems);
  }

  for (const movement of movementsWithDetailsResult.data ?? []) {
    if (!movement.reference_id) {
      continue;
    }

    const currentMovements = movementsByOrderId.get(movement.reference_id) ?? [];
    currentMovements.push(movement);
    movementsByOrderId.set(movement.reference_id, currentMovements);
  }

  for (const payment of paymentsResult.data ?? []) {
    const currentPayments = paymentsByOrderId.get(payment.product_order_id) ?? [];
    currentPayments.push(payment);
    paymentsByOrderId.set(payment.product_order_id, currentPayments);
  }

  return {
    data: orders.map(
      (order) => {
        const movements = movementsByOrderId.get(order.id) ?? [];

        return {
          ...order,
          customer: customersById.get(order.customer_id) ?? null,
          items: itemsByOrderId.get(order.id) ?? [],
          payments: paymentsByOrderId.get(order.id) ?? [],
          returnMovements: movements.filter(
            (movement) => movement.movement_type === "return",
          ),
          saleMovements: movements.filter(
            (movement) => movement.movement_type === "sale",
          ),
        } satisfies AdminProductOrder;
      },
    ),
    error: null,
  };
}

async function getSearchMatches(
  supabase: BCareSupabaseClient,
  search: string,
) {
  const normalizedSearch = normalizeSearchTerm(search);

  if (!normalizedSearch) {
    return {
      customerIds: [],
      serviceIds: [],
      vehicleIds: [],
      searchPattern: "",
    };
  }

  const searchPattern = `%${normalizedSearch}%`;

  const [customersResult, servicesResult, vehiclesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id")
      .or(
        `full_name.ilike.${searchPattern},phone_number.ilike.${searchPattern},email.ilike.${searchPattern}`,
      ),
    supabase.from("services").select("id").ilike("name", searchPattern),
    supabase.from("vehicles").select("id").ilike("license_plate", searchPattern),
  ]);

  if (customersResult.error) {
    return {
      error: customersResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      error: servicesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      error: vehiclesResult.error,
    };
  }

  return {
    customerIds: (customersResult.data ?? []).map((customer) => customer.id),
    serviceIds: (servicesResult.data ?? []).map((service) => service.id),
    vehicleIds: (vehiclesResult.data ?? []).map((vehicle) => vehicle.id),
    searchPattern,
  };
}

async function getProductOrderSearchMatches(
  supabase: BCareSupabaseClient,
  search: string,
) {
  const normalizedSearch = normalizeSearchTerm(search);

  if (!normalizedSearch) {
    return {
      customerIds: [],
      orderIds: [],
      searchPattern: "",
    };
  }

  const searchPattern = `%${normalizedSearch}%`;

  const [customersResult, productsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id")
      .or(
        `full_name.ilike.${searchPattern},phone_number.ilike.${searchPattern},email.ilike.${searchPattern}`,
      ),
    supabase
      .from("products")
      .select("id")
      .or(`name.ilike.${searchPattern},sku.ilike.${searchPattern}`),
  ]);

  if (customersResult.error) {
    return {
      error: customersResult.error,
    };
  }

  if (productsResult.error) {
    return {
      error: productsResult.error,
    };
  }

  const productIds = (productsResult.data ?? []).map((product) => product.id);
  const orderItemsResult =
    productIds.length > 0
      ? await supabase
          .from("product_order_items")
          .select("product_order_id")
          .in("product_id", productIds)
      : { data: [], error: null };

  if (orderItemsResult.error) {
    return {
      error: orderItemsResult.error,
    };
  }

  return {
    customerIds: (customersResult.data ?? []).map((customer) => customer.id),
    orderIds: getUniqueIds(
      (orderItemsResult.data ?? []).map((item) => item.product_order_id),
    ),
    searchPattern,
  };
}

async function attachAdminBookingDetails(
  supabase: BCareSupabaseClient,
  bookings: Database["public"]["Tables"]["bookings"]["Row"][],
) {
  const customerIds = getUniqueIds(
    bookings.map((booking) => booking.customer_id),
  );
  const serviceIds = getUniqueIds(
    bookings.map((booking) => booking.service_id),
  );
  const vehicleIds = getUniqueIds(
    bookings.map((booking) => booking.vehicle_id),
  );

  const [customersResult, servicesResult, vehiclesResult] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("profiles").select("*").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase.from("services").select("*").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase.from("vehicles").select("*").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResult.error) {
    return {
      data: null,
      error: customersResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  const customersById = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const vehiclesById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  return {
    data: bookings.map(
      (booking) =>
        ({
          ...booking,
          customer: customersById.get(booking.customer_id) ?? null,
          service: servicesById.get(booking.service_id) ?? null,
          vehicle: vehiclesById.get(booking.vehicle_id) ?? null,
        }) satisfies AdminBooking,
    ),
    error: null,
  };
}

export async function checkAdminAccess(
  supabase: BCareSupabaseClient,
  userId: string,
): Promise<AdminAccessResult> {
  const { data, error } = await getCurrentProfile(supabase, userId);

  if (error) {
    return {
      allowed: false,
      profile: null,
      reason: error.message,
    };
  }

  if (!data) {
    return {
      allowed: false,
      profile: null,
      reason: "Profile is required before admin access can be checked.",
    };
  }

  if (data.role !== "admin") {
    return {
      allowed: false,
      profile: data,
      reason: "This account is not assigned the admin role.",
    };
  }

  return {
    allowed: true,
    profile: data,
  };
}

export async function getAdminBookings(supabase: BCareSupabaseClient) {
  const bookingsResult = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const bookings = bookingsResult.data ?? [];
  return attachAdminBookingDetails(supabase, bookings);
}

export async function getAdminDashboardBookingCounts(
  supabase: BCareSupabaseClient,
  todayDate: string,
) {
  const statuses = [
    "pending",
    "confirmed",
    "cancelled",
    "completed",
  ] as const;
  const [pendingResult, confirmedResult, cancelledResult, completedResult, todayResult] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", statuses[0]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", statuses[1]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", statuses[2]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", statuses[3]),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("booking_date", todayDate),
    ]);
  const firstError =
    pendingResult.error ??
    confirmedResult.error ??
    cancelledResult.error ??
    completedResult.error ??
    todayResult.error;

  if (firstError) {
    return {
      data: null,
      error: firstError,
    };
  }

  return {
    data: {
      statusCounts: {
        cancelled: cancelledResult.count ?? 0,
        completed: completedResult.count ?? 0,
        confirmed: confirmedResult.count ?? 0,
        pending: pendingResult.count ?? 0,
      },
      todayCount: todayResult.count ?? 0,
    },
    error: null,
  };
}

export async function getAdminBookingsPage(
  supabase: BCareSupabaseClient,
  params: AdminBookingListParams,
) {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  const normalizedSearch = normalizeSearchTerm(params.search);

  let query = supabase
    .from("bookings")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (normalizedSearch) {
    const matches = await getSearchMatches(supabase, normalizedSearch);

    if ("error" in matches && matches.error) {
      return {
        data: null,
        error: matches.error,
      };
    }

    const searchParts = [`note.ilike.${matches.searchPattern}`];

    if (isUuid(normalizedSearch)) {
      searchParts.push(`id.eq.${normalizedSearch}`);
    }

    if (matches.customerIds.length > 0) {
      searchParts.push(`customer_id.in.(${matches.customerIds.join(",")})`);
    }

    if (matches.serviceIds.length > 0) {
      searchParts.push(`service_id.in.(${matches.serviceIds.join(",")})`);
    }

    if (matches.vehicleIds.length > 0) {
      searchParts.push(`vehicle_id.in.(${matches.vehicleIds.join(",")})`);
    }

    query = query.or(searchParts.join(","));
  }

  const bookingsResult = await query.range(rangeStart, rangeEnd);

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const detailsResult = await attachAdminBookingDetails(
    supabase,
    bookingsResult.data ?? [],
  );

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  const totalCount = bookingsResult.count ?? 0;

  return {
    data: {
      bookings: detailsResult.data ?? [],
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    error: null,
  };
}

export async function getAdminBookingById(
  supabase: BCareSupabaseClient,
  bookingId: string,
) {
  const bookingResult = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingResult.error) {
    return {
      data: null,
      error: bookingResult.error,
    };
  }

  if (!bookingResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const [customerResult, serviceResult, vehicleResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", bookingResult.data.customer_id)
      .maybeSingle(),
    supabase
      .from("services")
      .select("*")
      .eq("id", bookingResult.data.service_id)
      .maybeSingle(),
    supabase
      .from("vehicles")
      .select("*")
      .eq("id", bookingResult.data.vehicle_id)
      .maybeSingle(),
  ]);

  if (customerResult.error) {
    return {
      data: null,
      error: customerResult.error,
    };
  }

  if (serviceResult.error) {
    return {
      data: null,
      error: serviceResult.error,
    };
  }

  if (vehicleResult.error) {
    return {
      data: null,
      error: vehicleResult.error,
    };
  }

  return {
    data: {
      ...bookingResult.data,
      customer: customerResult.data,
      service: serviceResult.data,
      vehicle: vehicleResult.data,
    } satisfies AdminBooking,
    error: null,
  };
}

async function attachAdminRepairJobDetails(
  supabase: BCareSupabaseClient,
  repairJobs: RepairJob[],
) {
  const bookingIds = getUniqueIds(
    repairJobs.map((repairJob) => repairJob.booking_id),
  );
  const directCustomerIds = repairJobs
    .map((repairJob) => repairJob.customer_id)
    .filter((customerId): customerId is string => Boolean(customerId));
  const mechanicIds = repairJobs
    .map((repairJob) => repairJob.mechanic_id)
    .filter((mechanicId): mechanicId is string => Boolean(mechanicId));
  const directVehicleIds = repairJobs.map((repairJob) => repairJob.vehicle_id);

  const bookingsResult =
    bookingIds.length > 0
      ? await supabase.from("bookings").select("*").in("id", bookingIds)
      : { data: [], error: null };

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const bookings = bookingsResult.data ?? [];
  const bookingCustomerIds = bookings.map((booking) => booking.customer_id);
  const serviceIds = getUniqueIds(bookings.map((booking) => booking.service_id));
  const vehicleIds = getUniqueIds([
    ...directVehicleIds,
    ...bookings.map((booking) => booking.vehicle_id),
  ]);
  const customerIds = getUniqueIds([...directCustomerIds, ...bookingCustomerIds]);

  const [customersResult, mechanicsResult, servicesResult, vehiclesResult] =
    await Promise.all([
      customerIds.length > 0
        ? supabase.from("profiles").select("*").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      mechanicIds.length > 0
        ? supabase.from("profiles").select("*").in("id", mechanicIds)
        : Promise.resolve({ data: [], error: null }),
      serviceIds.length > 0
        ? supabase.from("services").select("*").in("id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length > 0
        ? supabase.from("vehicles").select("*").in("id", vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (customersResult.error) {
    return {
      data: null,
      error: customersResult.error,
    };
  }

  if (mechanicsResult.error) {
    return {
      data: null,
      error: mechanicsResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const customersById = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const mechanicsWithSkillsResult = await attachMechanicSkills(
    supabase,
    mechanicsResult.data ?? [],
  );

  if (mechanicsWithSkillsResult.error) {
    return {
      data: null,
      error: mechanicsWithSkillsResult.error,
    };
  }

  const mechanicsById = new Map(
    (mechanicsWithSkillsResult.data ?? []).map((mechanic) => [
      mechanic.id,
      mechanic,
    ]),
  );
  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const vehiclesById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  return {
    data: repairJobs.map((repairJob) => {
      const booking = bookingsById.get(repairJob.booking_id) ?? null;
      const customerId = repairJob.customer_id ?? booking?.customer_id ?? null;

      return {
        ...repairJob,
        booking,
        customer: customerId ? (customersById.get(customerId) ?? null) : null,
        mechanic: repairJob.mechanic_id
          ? (mechanicsById.get(repairJob.mechanic_id) ?? null)
          : null,
        service: booking ? (servicesById.get(booking.service_id) ?? null) : null,
        vehicle:
          vehiclesById.get(repairJob.vehicle_id) ??
          (booking ? (vehiclesById.get(booking.vehicle_id) ?? null) : null),
      } satisfies AdminRepairJob;
    }),
    error: null,
  };
}

export async function getAdminRepairJobs(supabase: BCareSupabaseClient) {
  const repairJobsResult = await supabase
    .from("repair_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (repairJobsResult.error) {
    return {
      data: null,
      error: repairJobsResult.error,
    };
  }

  return attachAdminRepairJobDetails(supabase, repairJobsResult.data ?? []);
}

export async function getAdminOpenRepairJobs(
  supabase: BCareSupabaseClient,
  limit = 50,
) {
  const repairJobsResult = await supabase
    .from("repair_jobs")
    .select("*")
    .in("status", ["pending", "assigned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (repairJobsResult.error) {
    return {
      data: null,
      error: repairJobsResult.error,
    };
  }

  return attachAdminRepairJobDetails(supabase, repairJobsResult.data ?? []);
}

export async function getAdminMechanics(supabase: BCareSupabaseClient) {
  const mechanicsResult = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "technician")
    .order("full_name", { ascending: true });

  if (mechanicsResult.error) {
    return {
      data: null,
      error: mechanicsResult.error,
    };
  }

  return attachMechanicSkills(supabase, mechanicsResult.data ?? []);
}

export async function getAdminRepairJobByBookingId(
  supabase: BCareSupabaseClient,
  bookingId: string,
) {
  const repairJobResult = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (repairJobResult.error) {
    return {
      data: null,
      error: repairJobResult.error,
    };
  }

  if (!repairJobResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const detailsResult = await attachAdminRepairJobDetails(supabase, [
    repairJobResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function createAdminRepairJobFromBooking(
  supabase: BCareSupabaseClient,
  bookingId: string,
) {
  const existingRepairJob = await getAdminRepairJobByBookingId(
    supabase,
    bookingId,
  );

  if (existingRepairJob.error || existingRepairJob.data) {
    return existingRepairJob;
  }

  const bookingResult = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingResult.error) {
    return {
      data: null,
      error: bookingResult.error,
    };
  }

  if (!bookingResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const repairJobResult = await supabase
    .from("repair_jobs")
    .insert({
      booking_id: bookingResult.data.id,
      customer_id: bookingResult.data.customer_id,
      status: "pending",
      vehicle_id: bookingResult.data.vehicle_id,
    })
    .select("*")
    .single();

  if (repairJobResult.error) {
    return {
      data: null,
      error: repairJobResult.error,
    };
  }

  const detailsResult = await attachAdminRepairJobDetails(supabase, [
    repairJobResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function updateAdminRepairJobMechanic(
  supabase: BCareSupabaseClient,
  repairJob: RepairJob,
  mechanicId: string | null,
) {
  const nextStatus =
    mechanicId && repairJob.status === "pending"
      ? "assigned"
      : !mechanicId && repairJob.status === "assigned"
        ? "pending"
        : repairJob.status;

  const repairJobResult = await supabase
    .from("repair_jobs")
    .update({
      mechanic_id: mechanicId,
      status: nextStatus,
    })
    .eq("id", repairJob.id)
    .select("*")
    .single();

  if (repairJobResult.error) {
    return {
      data: null,
      error: repairJobResult.error,
    };
  }

  const detailsResult = await attachAdminRepairJobDetails(supabase, [
    repairJobResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function updateAdminBookingStatus(
  supabase: BCareSupabaseClient,
  bookingId: string,
  status: AdminBookingStatusAction,
) {
  return supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)
    .select("*")
    .single();
}

export async function getAdminProductOrdersPage(
  supabase: BCareSupabaseClient,
  params: AdminProductOrderListParams,
) {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  const normalizedSearch = normalizeSearchTerm(params.search);

  let query = supabase
    .from("product_orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.paymentStatus !== "all") {
    query = query.eq("payment_status", params.paymentStatus);
  }

  if (normalizedSearch) {
    const matches = await getProductOrderSearchMatches(
      supabase,
      normalizedSearch,
    );

    if ("error" in matches && matches.error) {
      return {
        data: null,
        error: matches.error,
      };
    }

    const searchParts = [
      `order_number.ilike.${matches.searchPattern}`,
      `note.ilike.${matches.searchPattern}`,
      `delivery_address.ilike.${matches.searchPattern}`,
    ];

    if (isUuid(normalizedSearch)) {
      searchParts.push(`id.eq.${normalizedSearch}`);
    }

    if (matches.customerIds.length > 0) {
      searchParts.push(`customer_id.in.(${matches.customerIds.join(",")})`);
    }

    if (matches.orderIds.length > 0) {
      searchParts.push(`id.in.(${matches.orderIds.join(",")})`);
    }

    query = query.or(searchParts.join(","));
  }

  const ordersResult = await query.range(rangeStart, rangeEnd);

  if (ordersResult.error) {
    return {
      data: null,
      error: ordersResult.error,
    };
  }

  const detailsResult = await attachAdminProductOrderDetails(
    supabase,
    ordersResult.data ?? [],
  );

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  const totalCount = ordersResult.count ?? 0;

  return {
    data: {
      orders: detailsResult.data ?? [],
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    error: null,
  };
}

export async function getAdminProductOrderById(
  supabase: BCareSupabaseClient,
  orderId: string,
) {
  const orderResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  if (!orderResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const detailsResult = await attachAdminProductOrderDetails(supabase, [
    orderResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function updateAdminProductOrderStatus(
  supabase: BCareSupabaseClient,
  orderId: string,
  status: AdminProductOrderStatusAction,
) {
  if (status === "cancelled") {
    const cancellationResult = await supabase.rpc(
      "cancel_product_order_with_inventory_return",
      {
        target_order_id: orderId,
      },
    );

    if (cancellationResult.error) {
      return {
        data: null,
        error: cancellationResult.error,
      };
    }

    return supabase
      .from("product_orders")
      .select("*")
      .eq("id", orderId)
      .single();
  }

  return supabase
    .from("product_orders")
    .update({ status })
    .eq("id", orderId)
    .select("*")
    .single();
}

export async function approveAdminProductPayment(
  supabase: BCareSupabaseClient,
  paymentId: string,
) {
  const now = new Date().toISOString();

  const paymentResult = await supabase
    .from("product_payments")
    .update({
      paid_at: now,
      payment_status: "paid",
      rejected_reason: null,
      verification_status: "verified",
      verified_at: now,
    })
    .eq("id", paymentId)
    .select("*")
    .single();

  if (paymentResult.error) {
    return {
      data: null,
      error: paymentResult.error,
    };
  }

  const orderResult = await supabase
    .from("product_orders")
    .update({ payment_status: "paid" })
    .eq("id", paymentResult.data.product_order_id)
    .select("*")
    .single();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  return {
    data: {
      order: orderResult.data,
      payment: paymentResult.data,
    },
    error: null,
  };
}

export async function rejectAdminProductPayment(
  supabase: BCareSupabaseClient,
  paymentId: string,
  rejectedReason: string,
) {
  const paymentResult = await supabase
    .from("product_payments")
    .update({
      paid_at: null,
      payment_status: "failed",
      rejected_reason: rejectedReason,
      verification_status: "rejected",
      verified_at: null,
    })
    .eq("id", paymentId)
    .select("*")
    .single();

  if (paymentResult.error) {
    return {
      data: null,
      error: paymentResult.error,
    };
  }

  const paidPaymentsResult = await supabase
    .from("product_payments")
    .select("id")
    .eq("product_order_id", paymentResult.data.product_order_id)
    .eq("payment_status", "paid")
    .limit(1);

  if (paidPaymentsResult.error) {
    return {
      data: null,
      error: paidPaymentsResult.error,
    };
  }

  const nextOrderPaymentStatus =
    (paidPaymentsResult.data?.length ?? 0) > 0 ? "paid" : "unpaid";

  const orderResult = await supabase
    .from("product_orders")
    .update({ payment_status: nextOrderPaymentStatus })
    .eq("id", paymentResult.data.product_order_id)
    .select("*")
    .single();

  if (orderResult.error) {
    return {
      data: null,
      error: orderResult.error,
    };
  }

  return {
    data: {
      order: orderResult.data,
      payment: paymentResult.data,
    },
    error: null,
  };
}

export async function getAdminServices(supabase: BCareSupabaseClient) {
  const [servicesResult, categoriesResult] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("service_categories")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  const categoriesById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );

  return {
    data: (servicesResult.data ?? []).map(
      (service) =>
        ({
          ...service,
          category: categoriesById.get(service.service_category_id) ?? null,
        }) satisfies AdminService,
    ),
    error: null,
  };
}

export async function updateAdminService(
  supabase: BCareSupabaseClient,
  serviceId: string,
  input: AdminServiceUpdateInput,
) {
  return supabase
    .from("services")
    .update(input)
    .eq("id", serviceId)
    .select("*")
    .single();
}

export async function getAdminServiceCategories(
  supabase: BCareSupabaseClient,
) {
  return supabase
    .from("service_categories")
    .select("*")
    .order("name", { ascending: true });
}

export async function createAdminServiceCategory(
  supabase: BCareSupabaseClient,
  input: AdminServiceCategoryCreateInput,
) {
  return supabase
    .from("service_categories")
    .insert(input)
    .select("*")
    .single();
}

export async function updateAdminServiceCategory(
  supabase: BCareSupabaseClient,
  categoryId: string,
  input: AdminServiceCategoryUpdateInput,
) {
  return supabase
    .from("service_categories")
    .update(input)
    .eq("id", categoryId)
    .select("*")
    .single();
}

export async function getAdminProducts(supabase: BCareSupabaseClient) {
  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("product_categories")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (productsResult.error) {
    return {
      data: null,
      error: productsResult.error,
    };
  }

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  const categoriesById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );

  return {
    data: (productsResult.data ?? []).map(
      (product) =>
        ({
          ...product,
          category: categoriesById.get(product.product_category_id) ?? null,
        }) satisfies AdminProduct,
    ),
    error: null,
  };
}

export async function getAdminProductCategories(
  supabase: BCareSupabaseClient,
) {
  return supabase
    .from("product_categories")
    .select("*")
    .order("name", { ascending: true });
}

export async function createAdminProductCategory(
  supabase: BCareSupabaseClient,
  input: AdminProductCategoryCreateInput,
) {
  return supabase
    .from("product_categories")
    .insert(input)
    .select("*")
    .single();
}

export async function updateAdminProductCategory(
  supabase: BCareSupabaseClient,
  categoryId: string,
  input: AdminProductCategoryUpdateInput,
) {
  return supabase
    .from("product_categories")
    .update(input)
    .eq("id", categoryId)
    .select("*")
    .single();
}

export async function getAdminPaymentSetting(supabase: BCareSupabaseClient) {
  return supabase
    .from("payment_settings")
    .select("*")
    .eq("setting_key", "default")
    .maybeSingle();
}

export async function saveAdminPaymentSetting(
  supabase: BCareSupabaseClient,
  input: AdminPaymentSettingUpdateInput,
) {
  return supabase
    .from("payment_settings")
    .upsert(
      {
        ...input,
        setting_key: "default",
      },
      {
        onConflict: "setting_key",
      },
    )
    .select("*")
    .single();
}

export async function createAdminProduct(
  supabase: BCareSupabaseClient,
  input: AdminProductCreateInput,
) {
  return supabase
    .from("products")
    .insert({
      cost_price: input.cost_price,
      description: input.description,
      image_url: input.image_url,
      name: input.name,
      product_category_id: input.product_category_id,
      sku: input.sku,
      status: input.status,
      unit_price: input.unit_price,
    })
    .select("*")
    .single();
}

export async function updateAdminProduct(
  supabase: BCareSupabaseClient,
  productId: string,
  input: AdminProductUpdateInput,
) {
  return supabase
    .from("products")
    .update({
      cost_price: input.cost_price,
      description: input.description,
      image_url: input.image_url,
      name: input.name,
      product_category_id: input.product_category_id,
      sku: input.sku,
      status: input.status,
      unit_price: input.unit_price,
    })
    .eq("id", productId)
    .select("*")
    .single();
}

export async function getAdminInventoryMovements(
  supabase: BCareSupabaseClient,
  limit = 50,
) {
  const movementsResult = await supabase
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (movementsResult.error) {
    return {
      data: null,
      error: movementsResult.error,
    };
  }

  return attachInventoryMovementDetails(
    supabase,
    movementsResult.data ?? [],
  );
}

export async function createAdminInventoryMovement(
  supabase: BCareSupabaseClient,
  input: AdminInventoryMovementCreateInput,
) {
  const movementResult = await supabase
    .from("inventory_movements")
    .insert({
      movement_type: input.movement_type,
      note: input.note,
      product_id: input.product_id,
      quantity: input.quantity,
      reference_id: input.reference_id ?? null,
      reference_type: input.reference_type ?? null,
    })
    .select("*")
    .single();

  if (movementResult.error) {
    return {
      data: null,
      error: movementResult.error,
    };
  }

  const detailsResult = await attachInventoryMovementDetails(supabase, [
    movementResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function getAdminGarageCapacity(supabase: BCareSupabaseClient) {
  const [capacityResult, bookingsResult] = await Promise.all([
    supabase
      .from("garage_capacity")
      .select("*")
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true }),
    supabase
      .from("bookings")
      .select("*")
      .in("status", ["pending", "confirmed"]),
  ]);

  if (capacityResult.error) {
    return {
      data: null,
      error: capacityResult.error,
    };
  }

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  return {
    data: attachGarageCapacityUsage(
      capacityResult.data ?? [],
      bookingsResult.data ?? [],
    ),
    error: null,
  };
}

export async function createAdminGarageCapacity(
  supabase: BCareSupabaseClient,
  input: AdminGarageCapacityInput,
) {
  return supabase
    .from("garage_capacity")
    .insert({
      booking_date: input.booking_date,
      booking_time: input.booking_time,
      max_bookings: input.max_bookings,
      note: input.note,
      status: input.status,
    })
    .select("*")
    .single();
}

export async function updateAdminGarageCapacity(
  supabase: BCareSupabaseClient,
  capacityId: string,
  input: AdminGarageCapacityInput,
) {
  return supabase
    .from("garage_capacity")
    .update({
      booking_date: input.booking_date,
      booking_time: input.booking_time,
      max_bookings: input.max_bookings,
      note: input.note,
      status: input.status,
    })
    .eq("id", capacityId)
    .select("*")
    .single();
}

export async function getAdminGarageOperatingSettings(
  supabase: BCareSupabaseClient,
) {
  const [operatingDaysResult, closedDatesResult] = await Promise.all([
    supabase
      .from("garage_operating_days")
      .select("*")
      .order("weekday", { ascending: true }),
    supabase
      .from("garage_closed_dates")
      .select("*")
      .order("closed_date", { ascending: true }),
  ]);

  if (operatingDaysResult.error) {
    return {
      data: null,
      error: operatingDaysResult.error,
    };
  }

  if (closedDatesResult.error) {
    return {
      data: null,
      error: closedDatesResult.error,
    };
  }

  return {
    data: {
      closedDates: closedDatesResult.data ?? [],
      operatingDays: operatingDaysResult.data ?? [],
    },
    error: null,
  };
}

export async function updateAdminGarageOperatingDay(
  supabase: BCareSupabaseClient,
  weekday: number,
  input: AdminGarageOperatingDayInput,
) {
  return supabase
    .from("garage_operating_days")
    .update(input)
    .eq("weekday", weekday)
    .select("*")
    .single();
}

export async function createAdminGarageClosedDate(
  supabase: BCareSupabaseClient,
  input: AdminGarageClosedDateInput,
) {
  return supabase
    .from("garage_closed_dates")
    .insert(input)
    .select("*")
    .single();
}

export async function deleteAdminGarageClosedDate(
  supabase: BCareSupabaseClient,
  closedDate: string,
) {
  return supabase.from("garage_closed_dates").delete().eq("closed_date", closedDate);
}

export async function getAdminScheduleOverview(
  supabase: BCareSupabaseClient,
  startDate: string,
  dayCount = 7,
) {
  const normalizedDayCount = Math.min(Math.max(dayCount, 1), 14);
  const endDate = addDays(startDate, normalizedDayCount - 1);
  const [capacityResult, bookingsResult, operatingDaysResult, closedDatesResult] =
    await Promise.all([
    supabase
      .from("garage_capacity")
      .select("*")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true }),
    supabase
      .from("bookings")
      .select("*")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .in("status", ["pending", "confirmed"])
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true }),
    supabase
      .from("garage_operating_days")
      .select("*")
      .order("weekday", { ascending: true }),
    supabase
      .from("garage_closed_dates")
      .select("*")
      .gte("closed_date", startDate)
      .lte("closed_date", endDate)
      .order("closed_date", { ascending: true }),
  ]);

  if (capacityResult.error) {
    return {
      data: null,
      error: capacityResult.error,
    };
  }

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  if (operatingDaysResult.error) {
    return {
      data: null,
      error: operatingDaysResult.error,
    };
  }

  if (closedDatesResult.error) {
    return {
      data: null,
      error: closedDatesResult.error,
    };
  }

  return {
    data: buildScheduleOverview(
      startDate,
      normalizedDayCount,
      capacityResult.data ?? [],
      bookingsResult.data ?? [],
      operatingDaysResult.data ?? [],
      closedDatesResult.data ?? [],
    ),
    error: null,
  };
}

export async function getAdminTechnicianSkills(supabase: BCareSupabaseClient) {
  return supabase
    .from("technician_skills")
    .select("*")
    .order("name", { ascending: true });
}

export async function createAdminTechnicianSkill(
  supabase: BCareSupabaseClient,
  input: AdminTechnicianSkillCreateInput,
) {
  return supabase
    .from("technician_skills")
    .insert({
      description: input.description,
      name: input.name,
      status: input.status,
    })
    .select("*")
    .single();
}

export async function updateAdminTechnicianSkill(
  supabase: BCareSupabaseClient,
  skillId: string,
  input: AdminTechnicianSkillUpdateInput,
) {
  return supabase
    .from("technician_skills")
    .update({
      description: input.description,
      name: input.name,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", skillId)
    .select("*")
    .single();
}

export async function getAdminCustomers(supabase: BCareSupabaseClient) {
  const [profilesResult, vehiclesResult, bookingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("vehicles").select("*"),
    supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    return {
      data: null,
      error: profilesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const vehiclesByCustomerId = new Map<string, number>();
  const bookingsByCustomerId = new Map<string, number>();
  const latestBookingByCustomerId = new Map<
    string,
    Database["public"]["Tables"]["bookings"]["Row"]
  >();

  for (const vehicle of vehiclesResult.data ?? []) {
    vehiclesByCustomerId.set(
      vehicle.customer_id,
      (vehiclesByCustomerId.get(vehicle.customer_id) ?? 0) + 1,
    );
  }

  for (const booking of bookingsResult.data ?? []) {
    bookingsByCustomerId.set(
      booking.customer_id,
      (bookingsByCustomerId.get(booking.customer_id) ?? 0) + 1,
    );

    if (!latestBookingByCustomerId.has(booking.customer_id)) {
      latestBookingByCustomerId.set(booking.customer_id, booking);
    }
  }

  return {
    data: (profilesResult.data ?? []).map(
      (profile) =>
        ({
          ...profile,
          bookingCount: bookingsByCustomerId.get(profile.id) ?? 0,
          latestBooking: latestBookingByCustomerId.get(profile.id) ?? null,
          vehicleCount: vehiclesByCustomerId.get(profile.id) ?? 0,
        }) satisfies AdminCustomerSummary,
    ),
    error: null,
  };
}

export async function getAdminCustomerById(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const [profileResult, vehiclesResult, bookingsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", customerId).maybeSingle(),
    supabase
      .from("vehicles")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  if (!profileResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const bookings = bookingsResult.data ?? [];
  const serviceIds = getUniqueIds(
    bookings.map((booking) => booking.service_id),
  );
  const vehicleIds = getUniqueIds(
    bookings.map((booking) => booking.vehicle_id),
  );

  const [servicesResult, bookingVehiclesResult] = await Promise.all([
    serviceIds.length > 0
      ? supabase.from("services").select("*").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase.from("vehicles").select("*").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (bookingVehiclesResult.error) {
    return {
      data: null,
      error: bookingVehiclesResult.error,
    };
  }

  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const vehiclesById = new Map(
    (bookingVehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  return {
    data: {
      ...profileResult.data,
      bookings: bookings.map(
        (booking) =>
          ({
            ...booking,
            service: servicesById.get(booking.service_id) ?? null,
            vehicle: vehiclesById.get(booking.vehicle_id) ?? null,
          }) satisfies AdminCustomerBooking,
      ),
      vehicles: vehiclesResult.data ?? [],
    } satisfies AdminCustomerDetail,
    error: null,
  };
}

export async function getAdminReports(supabase: BCareSupabaseClient) {
  const [bookingsResult, profilesResult, servicesResult, vehiclesResult] =
    await Promise.all([
      supabase.from("bookings").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("services").select("*"),
      supabase.from("vehicles").select("*"),
    ]);

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  if (profilesResult.error) {
    return {
      data: null,
      error: profilesResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  const bookings = bookingsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const services = servicesResult.data ?? [];
  const vehicles = vehiclesResult.data ?? [];
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const statusCountsMap = new Map<AdminReports["statusCounts"][number]["status"], number>([
    ["pending", 0],
    ["confirmed", 0],
    ["cancelled", 0],
    ["completed", 0],
  ]);
  const serviceCountsMap = new Map<string, number>();
  const customerCountsMap = new Map<string, number>();
  const vehicleCountsMap = new Map<string, number>();
  let estimatedRevenue = 0;

  for (const booking of bookings) {
    statusCountsMap.set(
      booking.status,
      (statusCountsMap.get(booking.status) ?? 0) + 1,
    );
    incrementCount(serviceCountsMap, booking.service_id);
    incrementCount(customerCountsMap, booking.customer_id);
    incrementCount(vehicleCountsMap, booking.vehicle_id);

    if (booking.status === "confirmed" || booking.status === "completed") {
      estimatedRevenue += servicesById.get(booking.service_id)?.base_price ?? 0;
    }
  }

  const revenueBookingCount = bookings.filter(
    (booking) => booking.status === "confirmed" || booking.status === "completed",
  ).length;

  return {
    data: {
      activeCustomerCount: customerCountsMap.size,
      averageBookingValue:
        revenueBookingCount > 0
          ? Math.round(estimatedRevenue / revenueBookingCount)
          : 0,
      estimatedRevenue,
      statusCounts: Array.from(statusCountsMap.entries()).map(
        ([status, count]) => ({
          count,
          status,
        }),
      ),
      topCustomers: getTopCounts(customerCountsMap).map(
        ([customerId, bookingCount]) => ({
          bookingCount,
          customer: profilesById.get(customerId) ?? null,
        }),
      ),
      topServices: getTopCounts(serviceCountsMap).map(
        ([serviceId, bookingCount]) => ({
          bookingCount,
          service: servicesById.get(serviceId) ?? null,
        }),
      ),
      topVehicles: getTopCounts(vehicleCountsMap).map(
        ([vehicleId, bookingCount]) => ({
          bookingCount,
          vehicle: vehiclesById.get(vehicleId) ?? null,
        }),
      ),
      totalBookingCount: bookings.length,
      totalCustomerCount: profiles.length,
      totalVehicleCount: vehicles.length,
    } satisfies AdminReports,
    error: null,
  };
}
