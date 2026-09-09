// Generated wholesale, regenerate after every schema change. `supabase gen types
// --db-url` needs a local Docker/Podman runtime this machine doesn't have, so this
// was pulled via the Management API instead (needs SUPABASE_ACCESS_TOKEN and
// SUPABASE_PROJECT_REF in .env):
//   curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
//     "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/types/typescript?included_schemas=public" \
//     | jq -r '.types' > lib/database.types.ts
// Switch back to `supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema public`
// once Docker/Podman is available, or once CLI login supports sbp_v0_ tokens.
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
          price_last_updated_at: string | null
          price_source: string
          protein: number | null
          role: string | null
          sodium: number | null
          source: string | null
          source_description: string | null
          source_ref_id: string | null
          state: string | null
          sugar: number | null
          updated_at: string
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
          price_last_updated_at?: string | null
          price_source?: string
          protein?: number | null
          role?: string | null
          sodium?: number | null
          source?: string | null
          source_description?: string | null
          source_ref_id?: string | null
          state?: string | null
          sugar?: number | null
          updated_at?: string
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
          price_last_updated_at?: string | null
          price_source?: string
          protein?: number | null
          role?: string | null
          sodium?: number | null
          source?: string | null
          source_description?: string | null
          source_ref_id?: string | null
          state?: string | null
          sugar?: number | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
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

