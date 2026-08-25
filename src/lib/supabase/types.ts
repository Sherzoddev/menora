export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      venue_staff: {
        Row: {
          venue_id: string
          chat_id: number
          name: string | null
          added_at: string
        }
        Insert: {
          venue_id: string
          chat_id: number
          name?: string | null
          added_at?: string
        }
        Update: {
          venue_id?: string
          chat_id?: number
          name?: string | null
          added_at?: string
        }
        Relationships: []
      }
      bot_admins: {
        Row: {
          chat_id: number
          name: string | null
          added_at: string
        }
        Insert: {
          chat_id: number
          name?: string | null
          added_at?: string
        }
        Update: {
          chat_id?: number
          name?: string | null
          added_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "analytics_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_pending_price_edits: {
        Row: {
          chat_id: number
          created_at: string
          dish_id: string
          venue_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          dish_id: string
          venue_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          dish_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_pending_price_edits_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_pending_price_edits_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "bot_pending_price_edits_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_uz: string | null
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_uz?: string | null
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_uz?: string | null
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "categories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          category_id: string
          created_at: string
          currency: string
          description: string | null
          description_uz: string | null
          discount_price: number | null
          id: string
          is_available: boolean
          is_new: boolean
          is_popular: boolean
          name: string
          name_uz: string | null
          photo_url: string | null
          price: number
          out_of_stock: boolean
          sort_order: number
          updated_at: string
          velora_product_id: string | null
          venue_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: string
          description?: string | null
          description_uz?: string | null
          discount_price?: number | null
          id?: string
          is_available?: boolean
          is_new?: boolean
          is_popular?: boolean
          name: string
          name_uz?: string | null
          out_of_stock?: boolean
          photo_url?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          velora_product_id?: string | null
          venue_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          description_uz?: string | null
          discount_price?: number | null
          id?: string
          is_available?: boolean
          is_new?: boolean
          is_popular?: boolean
          name?: string
          name_uz?: string | null
          out_of_stock?: boolean
          photo_url?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          velora_product_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "dishes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          id: string
          phone: string
          points: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          id?: string
          phone: string
          points?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          id?: string
          phone?: string
          points?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "loyalty_points_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          type: string
          venue_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          type: string
          venue_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "notifications_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          dish_id: string | null
          dish_name: string
          id: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          dish_id?: string | null
          dish_name: string
          id?: string
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          dish_id?: string | null
          dish_name?: string
          id?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          client_request_id: string | null
          comment: string | null
          created_at: string
          customer_name: string
          customer_telegram_chat_id: number | null
          customer_tracker_message_id: number | null
          discount: number
          fulfillment: string
          id: string
          order_number: number
          phone: string
          points_earned: number
          points_redeemed: number
          printed_at: string | null
          promo_code: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          table_number: string | null
          total: number
          venue_id: string
        }
        Insert: {
          address?: string | null
          client_request_id?: string | null
          comment?: string | null
          created_at?: string
          customer_name: string
          customer_telegram_chat_id?: number | null
          customer_tracker_message_id?: number | null
          discount?: number
          fulfillment: string
          id?: string
          order_number?: number
          phone: string
          points_earned?: number
          points_redeemed?: number
          printed_at?: string | null
          promo_code?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          table_number?: string | null
          total?: number
          venue_id: string
        }
        Update: {
          address?: string | null
          client_request_id?: string | null
          comment?: string | null
          created_at?: string
          customer_name?: string
          customer_telegram_chat_id?: number | null
          customer_tracker_message_id?: number | null
          discount?: number
          fulfillment?: string
          id?: string
          order_number?: number
          phone?: string
          points_earned?: number
          points_redeemed?: number
          printed_at?: string | null
          promo_code?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          table_number?: string | null
          total?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "orders_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          used_count: number
          venue_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
          venue_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          used_count?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "promo_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string
          id: string
          variant: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          variant: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          variant?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "qr_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_requests: {
        Row: {
          created_at: string
          id: string
          order_id: string
          send_after: string
          sent_at: string | null
          telegram_chat_id: number
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          send_after: string
          sent_at?: string | null
          telegram_chat_id: number
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          send_after?: string
          sent_at?: string | null
          telegram_chat_id?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "rating_requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          tags: string[] | null
          telegram_chat_id: number | null
          venue_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          tags?: string[] | null
          telegram_chat_id?: number | null
          venue_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          tags?: string[] | null
          telegram_chat_id?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "ratings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      table_carts: {
        Row: {
          currency: string
          dish_id: string
          dish_name: string
          price: number
          quantity: number
          table_number: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          currency?: string
          dish_id: string
          dish_name: string
          price: number
          quantity?: number
          table_number: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          currency?: string
          dish_id?: string
          dish_name?: string
          price?: number
          quantity?: number
          table_number?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_carts_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_carts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "table_carts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_customers: {
        Row: {
          active_table_number: string | null
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          language: string | null
          last_name: string | null
          phone: string | null
          telegram_user_id: number
          updated_at: string
          username: string | null
          venue_id: string
        }
        Insert: {
          active_table_number?: string | null
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          telegram_user_id: number
          updated_at?: string
          username?: string | null
          venue_id: string
        }
        Update: {
          active_table_number?: string | null
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_name?: string | null
          phone?: string | null
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_customers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "telegram_customers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          used_at: string | null
          used_by: string | null
          venue_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
          venue_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_invite_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_invite_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_users: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_users_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_users_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          accent_color: string | null
          address: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          instagram: string | null
          is_active: boolean
          languages: string[]
          logo_url: string | null
          loyalty_percent: number
          name: string
          next_order_number: number
          phone: string | null
          primary_color: string | null
          slug: string
          staff_bot_language: string | null
          staff_invite_code: string | null
          telegram: string | null
          telegram_bot_token: string | null
          telegram_bot_username: string | null
          telegram_chat_id: number | null
          updated_at: string
          velora_token: string | null
          velora_venue_id: string | null
          views_count: number
          working_hours: Json
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          loyalty_percent?: number
          name: string
          next_order_number?: number
          phone?: string | null
          primary_color?: string | null
          slug: string
          staff_bot_language?: string | null
          staff_invite_code?: string | null
          telegram?: string | null
          telegram_bot_token?: string | null
          telegram_bot_username?: string | null
          telegram_chat_id?: number | null
          updated_at?: string
          velora_token?: string | null
          velora_venue_id?: string | null
          views_count?: number
          working_hours?: Json
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          languages?: string[]
          logo_url?: string | null
          loyalty_percent?: number
          name?: string
          next_order_number?: number
          phone?: string | null
          primary_color?: string | null
          slug?: string
          staff_bot_language?: string | null
          staff_invite_code?: string | null
          telegram?: string | null
          telegram_bot_token?: string | null
          telegram_bot_username?: string | null
          telegram_chat_id?: number | null
          updated_at?: string
          velora_token?: string | null
          velora_venue_id?: string | null
          views_count?: number
          working_hours?: Json
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          created_at: string
          id: string
          table_number: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          table_number?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          table_number?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_stats"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "waiter_calls_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      venue_stats: {
        Row: {
          categories_count: number | null
          dishes_count: number | null
          scans_count: number | null
          venue_id: string | null
          views_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_table_cart_item: {
        Args: {
          p_currency: string
          p_delta: number
          p_dish_id: string
          p_dish_name: string
          p_price: number
          p_table_number: string
          p_venue_id: string
        }
        Returns: undefined
      }
      send_due_rating_requests: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
