// ────────────────────────────────────────────────────────────
// Database types for TP-Manager (mirrors Supabase schema)
// ────────────────────────────────────────────────────────────

/** Role hierarchy for admin access */
export type UserRole = "admin" | "super_admin" | "god_admin" | "driver";

/** Order fulfillment status */
export type OrderStatus = "pending" | "assigned" | "en_route" | "delivered" | "cancelled";

/** Access grade tiers */
export type TokenGrade = "classic" | "premium";

// ────────────────────────────────────────────────────────────
// Row types (what you SELECT from the database)
// ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  profile_picture_url: string | null;
  phone: string | null;
  vehicle_info: string | null;
  is_active: boolean;
  is_trusted: boolean;
  created_at: string;
  updated_at: string;
}

/** Profile without sensitive fields — safe to send to the client */
export type ProfilePublic = Omit<Profile, "password_hash">;

export interface Item {
  id: string;
  name: string;
  type: string | null;
  variety: string;
  quantity: number;
  unit_measure: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  custom_fields: Record<string, unknown>;
  low_stock_threshold: number | null;
  badges: string[];
  is_featured: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Item with limited fields — safe to expose on public order form */
export interface PublicItem {
  id: string;
  name: string;
  type: string | null;
  variety: string;
  price: number;
  unit_measure: string;
  image_url: string | null;
  category_id: string | null;
  custom_fields: Record<string, unknown>;
  low_stock_threshold: number | null;
  quantity_available: number;
  badges: string[];
  is_featured: boolean;
  pricing_tiers: { unit: string; price: number }[];
}

// ────────────────────────────────────────────────────────────
// Categories & Stock
// ────────────────────────────────────────────────────────────

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  required: boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  grade_visibility: "classic" | "premium";
  unit_type: "weight" | "count" | "volume";
  custom_fields_schema: CustomFieldDefinition[];
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockAvailability = "available" | "low" | "unavailable";

export interface StockDecrementItem {
  item_id: string;
  quantity: number;
}

export interface StockDecrementResult {
  item_id: string;
  success: boolean;
  remaining: number;
  error: string | null;
}

export type CategoryInsert = Omit<Category, "id" | "created_at" | "updated_at">;
export type CategoryUpdate = Partial<CategoryInsert>;

export interface Order {
  id: string;
  address: string;
  status: OrderStatus;
  grade: TokenGrade;
  token_id: string | null;
  notes: string | null;
  assigned_driver_id: string | null;
  assigned_at: string | null;
  delivered_at: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  latitude: number | null;
  longitude: number | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_code: string | null;
  promo_code_id: string | null;
  discount_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  name: string;
  variety: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category_slug: string | null;
  custom_fields: Record<string, unknown>;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface SecureToken {
  id: string;
  token: string;
  grade: TokenGrade;
  expires_at: string;
  used: boolean;
  fingerprint: string | null;
  ip_address: string | null;
  access_attempts: number;
  locked: boolean;
  created_by: string | null;
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

export interface DeliveryProof {
  id: string;
  order_id: string;
  driver_id: string;
  photo_url: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface DeliveryRoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface DeliveryRoute {
  id: string;
  order_id: string;
  driver_id: string;
  route_points: DeliveryRoutePoint[];
  started_at: string | null;
  completed_at: string | null;
  distance_km: number | null;
  created_at: string;
}

export type DeliveryRouteInsert = Omit<DeliveryRoute, "id" | "created_at">;

// ────────────────────────────────────────────────────────────
// Chat
// ────────────────────────────────────────────────────────────

export interface ChatConversation {
  id: string;
  admin_id: string;
  driver_id: string;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export type ChatConversationInsert = Omit<
  ChatConversation,
  "id" | "created_at" | "last_message_at"
>;
export type ChatMessageInsert = Omit<ChatMessage, "id" | "created_at" | "read_at">;

// ────────────────────────────────────────────────────────────
// Driver Shifts
// ────────────────────────────────────────────────────────────

export interface DriverShift {
  id: string;
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  orders_completed: number;
  total_distance_km: number;
  total_revenue: number;
  notes: string | null;
  created_at: string;
}

export type DriverShiftInsert = Omit<DriverShift, "id" | "created_at">;

// ────────────────────────────────────────────────────────────
// Push Subscriptions
// ────────────────────────────────────────────────────────────

export interface PushSubscription {
  id: string;
  order_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Pricing Tiers
// ────────────────────────────────────────────────────────────

export interface PricingTier {
  id: string;
  item_id: string;
  unit: string;
  price: number;
  min_quantity: number;
  max_quantity: number | null;
  sort_order: number;
  created_at: string;
}

export type PricingTierInsert = Omit<PricingTier, "id" | "created_at">;

// ────────────────────────────────────────────────────────────
// Promo Codes
// ────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type PromoCodeInsert = Omit<PromoCode, "id" | "current_uses" | "created_at">;

// ────────────────────────────────────────────────────────────
// App Settings
// ────────────────────────────────────────────────────────────

export interface DeliveryFeeTier {
  min_miles: number;
  max_miles: number;
  fee: number;
}

export interface AppSettings {
  delivery_radius_miles: number;
  currency_symbol: string;
  min_order_amount: number;
  delivery_fee_tiers: DeliveryFeeTier[];
  default_latitude: number;
  default_longitude: number;
}

export interface AppSettingRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type AppSettingInsert = Omit<AppSettingRow, "updated_at">;
export type AppSettingUpdate = Partial<Omit<AppSettingRow, "key">>;

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Payroll
// ────────────────────────────────────────────────────────────

export type PayrollStatus = "pending" | "approved" | "paid";

export interface DriverPayroll {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  base_pay: number;
  delivery_bonus: number;
  total_pay: number;
  status: PayrollStatus;
  created_at: string;
}

export type DriverPayrollInsert = Omit<DriverPayroll, "id" | "created_at">;
export type DriverPayrollUpdate = Partial<Omit<DriverPayroll, "id" | "created_at">>;

// ────────────────────────────────────────────────────────────
// MFA Credentials
// ────────────────────────────────────────────────────────────

export type CredentialType = "webauthn" | "totp";

export interface UserCredential {
  id: string;
  user_id: string;
  credential_type: CredentialType;
  credential_id: string | null;
  public_key: string | null;
  counter: number;
  transports: string[];
  totp_secret: string | null;
  name: string;
  created_at: string;
}

export type UserCredentialInsert = Omit<UserCredential, "id" | "created_at">;

export interface AuthChallenge {
  id: string;
  user_id: string;
  challenge: string;
  expires_at: string;
  created_at: string;
}

export type AuthChallengeInsert = Omit<AuthChallenge, "id" | "created_at">;

// ────────────────────────────────────────────────────────────
// Insert types (what you INSERT — omit server-generated fields)
// ────────────────────────────────────────────────────────────

export type ProfileInsert = Omit<Profile, "id" | "created_at" | "updated_at">;
export type ItemInsert = Omit<Item, "id" | "created_at" | "updated_at">;
export type OrderInsert = Omit<Order, "id" | "created_at" | "updated_at">;
export type OrderItemInsert = Omit<OrderItem, "id">;
export type SecureTokenInsert = Omit<SecureToken, "id" | "created_at">;
export type AuditLogInsert = Omit<AuditLog, "id" | "created_at">;
export type DriverLocationInsert = Omit<DriverLocation, "id" | "recorded_at">;
export type DeliveryProofInsert = Omit<DeliveryProof, "id" | "created_at">;
export type PushSubscriptionInsert = Omit<PushSubscription, "id" | "created_at">;

// ────────────────────────────────────────────────────────────
// Update types (all fields optional except id)
// ────────────────────────────────────────────────────────────

export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;
export type ItemUpdate = Partial<Omit<Item, "id" | "created_at">>;
export type OrderUpdate = Partial<Omit<Order, "id" | "created_at">>;
export type OrderItemUpdate = Partial<Omit<OrderItem, "id">>;
export type SecureTokenUpdate = Partial<Omit<SecureToken, "id" | "created_at">>;
export type DriverLocationUpdate = Partial<Omit<DriverLocation, "id" | "recorded_at">>;
export type DeliveryProofUpdate = Partial<Omit<DeliveryProof, "id" | "created_at">>;

// ────────────────────────────────────────────────────────────
// Supabase typed-client helper
// ────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      items: {
        Row: Item;
        Insert: ItemInsert;
        Update: ItemUpdate;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItem;
        Insert: OrderItemInsert;
        Update: OrderItemUpdate;
      };
      secure_tokens: {
        Row: SecureToken;
        Insert: SecureTokenInsert;
        Update: SecureTokenUpdate;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: AuditLogInsert;
      };
      categories: {
        Row: Category;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      driver_locations: {
        Row: DriverLocation;
        Insert: DriverLocationInsert;
        Update: DriverLocationUpdate;
      };
      delivery_proofs: {
        Row: DeliveryProof;
        Insert: DeliveryProofInsert;
        Update: DeliveryProofUpdate;
      };
      delivery_routes: {
        Row: DeliveryRoute;
        Insert: DeliveryRouteInsert;
        Update: Partial<DeliveryRouteInsert>;
      };
      app_settings: {
        Row: AppSettingRow;
        Insert: AppSettingInsert;
        Update: AppSettingUpdate;
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: PushSubscriptionInsert;
      };
      driver_shifts: {
        Row: DriverShift;
        Insert: DriverShiftInsert;
      };
      chat_conversations: {
        Row: ChatConversation;
        Insert: ChatConversationInsert;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: ChatMessageInsert;
      };
      user_credentials: {
        Row: UserCredential;
        Insert: UserCredentialInsert;
      };
      auth_challenges: {
        Row: AuthChallenge;
        Insert: AuthChallengeInsert;
      };
      driver_payroll: {
        Row: DriverPayroll;
        Insert: DriverPayrollInsert;
        Update: DriverPayrollUpdate;
      };
    };
  };
}
