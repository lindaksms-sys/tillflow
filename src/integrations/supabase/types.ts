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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      business_members: {
        Row: {
          business_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          role: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          country: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          trial_ends_at: string | null
          type: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          trial_ends_at?: string | null
          type: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          trial_ends_at?: string | null
          type?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_id: string | null
          category: string
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          business_id?: string | null
          category: string
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          business_id?: string | null
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string | null
          business_type: string
          category: string
          cost_price: number
          created_at: string
          id: string
          name: string
          reorder_threshold: number
          selling_price: number
          sku: string | null
          unit: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          business_type?: string
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          name: string
          reorder_threshold?: number
          selling_price?: number
          sku?: string | null
          unit?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          business_type?: string
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          name?: string
          reorder_threshold?: number
          selling_price?: number
          sku?: string | null
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          bundle_price: number
          bundle_qty: number
          business_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          product_id: string
        }
        Insert: {
          bundle_price: number
          bundle_qty: number
          business_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          product_id: string
        }
        Update: {
          bundle_price?: number
          bundle_qty?: number
          business_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_admin: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          discount_amount: number
          id: string
          product_id: string
          promo_label: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          discount_amount?: number
          id?: string
          product_id: string
          promo_label?: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          discount_amount?: number
          id?: string
          product_id?: string
          promo_label?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          is_voided: boolean
          notes: string | null
          payment_method: string
          total_amount: number
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          is_voided?: boolean
          notes?: string | null
          payment_method: string
          total_amount?: number
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          is_voided?: boolean
          notes?: string | null
          payment_method?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          type: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          type: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          business_id: string | null
          id: string
          last_updated: string
          product_id: string
          quantity: number
        }
        Insert: {
          business_id?: string | null
          id?: string
          last_updated?: string
          product_id: string
          quantity?: number
        }
        Update: {
          business_id?: string | null
          id?: string
          last_updated?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_business_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
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
