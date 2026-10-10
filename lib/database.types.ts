// Generated wholesale — do not hand-edit. Regenerate after any schema
// change via the Management API (Docker isn't installed locally, so
// `supabase gen types` itself can't run here):
//   source .env && curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
//     "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/types/typescript?included_schemas=public" \
//     | python3 -c "import json,sys; print(json.load(sys.stdin)['types'])" > lib/database.types.ts

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      da_commodities: {
        Row: {
          commodity: string
          created_at: string
          id: string
          ingredient_id: string | null
          latest_price: number | null
          latest_price_date: string | null
          section: string | null
          specification: string
          unit: string
          unit_size: number | null
        }
        Insert: {
          commodity: string
          created_at?: string
          id?: string
          ingredient_id?: string | null
          latest_price?: number | null
          latest_price_date?: string | null
          section?: string | null
          specification?: string
          unit: string
          unit_size?: number | null
        }
        Update: {
          commodity?: string
          created_at?: string
          id?: string
          ingredient_id?: string | null
          latest_price?: number | null
          latest_price_date?: string | null
          section?: string | null
          specification?: string
          unit?: string
          unit_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "da_commodities_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_prices: {
        Row: {
          created_at: string
          da_commodity_id: string
          id: string
          price: number
          price_date: string
          source_url: string | null
        }
        Insert: {
          created_at?: string
          da_commodity_id: string
          id?: string
          price: number
          price_date: string
          source_url?: string | null
        }
        Update: {
          created_at?: string
          da_commodity_id?: string
          id?: string
          price?: number
          price_date?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_prices_da_commodity_id_fkey"
            columns: ["da_commodity_id"]
            isOneToOne: false
            referencedRelation: "da_commodities"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          aliases: string[]
          archived_at: string | null
          basis_amount: number
          basis_unit: string
          calories: number | null
          canonical_name: string
          carbohydrates: number | null
          category: string | null
          created_at: string
          display_name: string | null
          estimated_price: number | null
          estimated_price_unit: string | null
          fat: number | null
          fiber: number | null
          food_group: string | null
          grams_per_ml: number | null
          grams_per_piece: number | null
          id: string
          last_verified_at: string | null
          match_type: string | null
          piece_label: string | null
          price_last_attempted_at: string | null
          price_last_updated_at: string | null
          price_source: string
          price_sources: Json | null
          protein: number | null
          role: string | null
          sodium: number | null
          source: string | null
          source_description: string | null
          source_ref_id: string | null
          state: string | null
          sugar: number | null
          updated_at: string
          usda_last_attempted_at: string | null
          verification_status: string
        }
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          basis_amount?: number
          basis_unit?: string
          calories?: number | null
          canonical_name: string
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          display_name?: string | null
          estimated_price?: number | null
          estimated_price_unit?: string | null
          fat?: number | null
          fiber?: number | null
          food_group?: string | null
          grams_per_ml?: number | null
          grams_per_piece?: number | null
          id?: string
          last_verified_at?: string | null
          match_type?: string | null
          piece_label?: string | null
          price_last_attempted_at?: string | null
          price_last_updated_at?: string | null
          price_source?: string
          price_sources?: Json | null
          protein?: number | null
          role?: string | null
          sodium?: number | null
          source?: string | null
          source_description?: string | null
          source_ref_id?: string | null
          state?: string | null
          sugar?: number | null
          updated_at?: string
          usda_last_attempted_at?: string | null
          verification_status?: string
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          basis_amount?: number
          basis_unit?: string
          calories?: number | null
          canonical_name?: string
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          display_name?: string | null
          estimated_price?: number | null
          estimated_price_unit?: string | null
          fat?: number | null
          fiber?: number | null
          food_group?: string | null
          grams_per_ml?: number | null
          grams_per_piece?: number | null
          id?: string
          last_verified_at?: string | null
          match_type?: string | null
          piece_label?: string | null
          price_last_attempted_at?: string | null
          price_last_updated_at?: string | null
          price_source?: string
          price_sources?: Json | null
          protein?: number | null
          role?: string | null
          sodium?: number | null
          source?: string | null
          source_description?: string | null
          source_ref_id?: string | null
          state?: string | null
          sugar?: number | null
          updated_at?: string
          usda_last_attempted_at?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          created_at: string
          display_text: string
          id: string
          ingredient_id: string
          meal_id: string
          note: string | null
          price_quantity_amount: number | null
          price_quantity_unit: string | null
          quantity_amount: number | null
          quantity_unit: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_text: string
          id?: string
          ingredient_id: string
          meal_id: string
          note?: string | null
          price_quantity_amount?: number | null
          price_quantity_unit?: string | null
          quantity_amount?: number | null
          quantity_unit?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_text?: string
          id?: string
          ingredient_id?: string
          meal_id?: string
          note?: string | null
          price_quantity_amount?: number | null
          price_quantity_unit?: string | null
          quantity_amount?: number | null
          quantity_unit?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          allergens: string[]
          archived_at: string | null
          budget_range: string | null
          calories: number | null
          carbohydrates: number | null
          category: string | null
          created_at: string
          description: string | null
          dietary_tags: string[]
          difficulty: string | null
          fat: number | null
          id: string
          image_attribution: string | null
          image_url: string | null
          ingredients_synced_at: string | null
          name: string
          poster_id: string | null
          prep_time: number | null
          price: number | null
          procedure: string[]
          protein: number | null
          protein_type: string | null
          reference_image_url: string | null
          rejection_reason: string | null
          restaurant: string | null
          serving_size: number
          source: string | null
          source_type: string | null
          status: string
          tags: string[]
          total_time: number | null
          unlinked_ingredients: Json
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          archived_at?: string | null
          budget_range?: string | null
          calories?: number | null
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          difficulty?: string | null
          fat?: number | null
          id?: string
          image_attribution?: string | null
          image_url?: string | null
          ingredients_synced_at?: string | null
          name: string
          poster_id?: string | null
          prep_time?: number | null
          price?: number | null
          procedure?: string[]
          protein?: number | null
          protein_type?: string | null
          reference_image_url?: string | null
          rejection_reason?: string | null
          restaurant?: string | null
          serving_size?: number
          source?: string | null
          source_type?: string | null
          status?: string
          tags?: string[]
          total_time?: number | null
          unlinked_ingredients?: Json
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          archived_at?: string | null
          budget_range?: string | null
          calories?: number | null
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          difficulty?: string | null
          fat?: number | null
          id?: string
          image_attribution?: string | null
          image_url?: string | null
          ingredients_synced_at?: string | null
          name?: string
          poster_id?: string | null
          prep_time?: number | null
          price?: number | null
          procedure?: string[]
          protein?: number | null
          protein_type?: string | null
          reference_image_url?: string | null
          rejection_reason?: string | null
          restaurant?: string | null
          serving_size?: number
          source?: string | null
          source_type?: string | null
          status?: string
          tags?: string[]
          total_time?: number | null
          unlinked_ingredients?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          preferences: Json
          tier: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          preferences?: Json
          tier?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          preferences?: Json
          tier?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

