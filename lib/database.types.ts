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
    PostgrestVersion: "14.17"
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
      daily_usage: {
        Row: {
          count: number
          day: string
          kind: string
          last: string | null
          seen: string[]
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          kind: string
          last?: string | null
          seen?: string[]
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          kind?: string
          last?: string | null
          seen?: string[]
          user_id?: string
        }
        Relationships: []
      }
      food_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "food_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      food_posts: {
        Row: {
          caption: string | null
          created_at: string
          gif_url: string | null
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          image_url: string | null
          link_description: string | null
          link_image: string | null
          link_title: string | null
          link_url: string | null
          sticker_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          gif_url?: string | null
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          sticker_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          gif_url?: string | null
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          image_url?: string | null
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          sticker_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_checks: {
        Row: {
          checked_at: string
          item_key: string
          list: string
          qty: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          item_key: string
          list?: string
          qty: string
          user_id: string
        }
        Update: {
          checked_at?: string
          item_key?: string
          list?: string
          qty?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          aliases: string[]
          archived_at: string | null
          basis_amount: number
          basis_unit: string
          bridge_note: string | null
          calories: number | null
          canonical_name: string
          carbohydrates: number | null
          category: string | null
          created_at: string
          density_verified_at: string | null
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
          macros_verified_at: string | null
          match_type: string | null
          piece_label: string | null
          piece_verified_at: string | null
          price_last_attempted_at: string | null
          price_last_updated_at: string | null
          price_source: string
          price_sources: Json | null
          price_verified_at: string | null
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
          bridge_note?: string | null
          calories?: number | null
          canonical_name: string
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          density_verified_at?: string | null
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
          macros_verified_at?: string | null
          match_type?: string | null
          piece_label?: string | null
          piece_verified_at?: string | null
          price_last_attempted_at?: string | null
          price_last_updated_at?: string | null
          price_source?: string
          price_sources?: Json | null
          price_verified_at?: string | null
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
          bridge_note?: string | null
          calories?: number | null
          canonical_name?: string
          carbohydrates?: number | null
          category?: string | null
          created_at?: string
          density_verified_at?: string | null
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
          macros_verified_at?: string | null
          match_type?: string | null
          piece_label?: string | null
          piece_verified_at?: string | null
          price_last_attempted_at?: string | null
          price_last_updated_at?: string | null
          price_source?: string
          price_sources?: Json | null
          price_verified_at?: string | null
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
          section: string | null
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
          section?: string | null
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
          section?: string | null
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
      meal_plans: {
        Row: {
          budget: number
          days: Json
          goal: string | null
          servings: number
          start_date: string
          targets: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget: number
          days: Json
          goal?: string | null
          servings: number
          start_date: string
          targets?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          days?: Json
          goal?: string | null
          servings?: number
          start_date?: string
          targets?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_sources: {
        Row: {
          imported_at: string
          meal_id: string
          url: string
        }
        Insert: {
          imported_at?: string
          meal_id: string
          url: string
        }
        Update: {
          imported_at?: string
          meal_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_sources_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: true
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
          save_count: number
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
          save_count?: number
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
          save_count?: number
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
      pantry_items: {
        Row: {
          added_at: string
          ingredient_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          ingredient_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          ingredient_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          post_id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
          reason: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "food_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_rewards: {
        Row: {
          days: number
          granted_at: string
          id: string
          kind: string
          source_id: string
          user_id: string
        }
        Insert: {
          days: number
          granted_at?: string
          id?: string
          kind: string
          source_id: string
          user_id: string
        }
        Update: {
          days?: number
          granted_at?: string
          id?: string
          kind?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_meals: {
        Row: {
          id: string
          meal_data: Json
          meal_id: string | null
          meal_key: string
          saved_at: string
          serving_size: number
          synced_at: string
          user_id: string
        }
        Insert: {
          id?: string
          meal_data: Json
          meal_id?: string | null
          meal_key: string
          saved_at?: string
          serving_size?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          id?: string
          meal_data?: Json
          meal_id?: string | null
          meal_key?: string
          saved_at?: string
          serving_size?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          earn_pro_prompt: Json
          email: string
          id: string
          newsletter_subscribed: boolean
          preferences: Json
          pro_reward_until: string | null
          pro_until: string | null
          seen_intros: string[]
          show_saved_public: boolean
          tier: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          earn_pro_prompt?: Json
          email: string
          id: string
          newsletter_subscribed?: boolean
          preferences?: Json
          pro_reward_until?: string | null
          pro_until?: string | null
          seen_intros?: string[]
          show_saved_public?: boolean
          tier?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          earn_pro_prompt?: Json
          email?: string
          id?: string
          newsletter_subscribed?: boolean
          preferences?: Json
          pro_reward_until?: string | null
          pro_until?: string | null
          seen_intros?: string[]
          show_saved_public?: boolean
          tier?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_daily_use: {
        Args: { p_kind: string; p_refines?: boolean; p_signature: string }
        Returns: {
          allowed: boolean
          uses_left: number
        }[]
      }
      daily_limit: { Args: { p_kind: string }; Returns: number }
      daily_uses_left: { Args: { p_kind: string }; Returns: number }
      dismiss_post_reports: { Args: { p_post: string }; Returns: undefined }
      get_food_posts: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          avatar_url: string
          caption: string
          created_at: string
          display_name: string
          gif_url: string
          hidden: boolean
          id: string
          image_url: string
          like_count: number
          liked: boolean
          link_description: string
          link_image: string
          link_title: string
          link_url: string
          sticker_url: string
          updated_at: string
          user_id: string
        }[]
      }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          show_saved_public: boolean
        }[]
      }
      get_public_saved_meals: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          meal_data: Json
          meal_id: string | null
          meal_key: string
          saved_at: string
          serving_size: number
          synced_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "saved_meals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_reported_posts: {
        Args: never
        Returns: {
          avatar_url: string
          caption: string
          created_at: string
          display_name: string
          gif_url: string
          hidden: boolean
          id: string
          image_url: string
          last_reported_at: string
          link_url: string
          notes: string[]
          reasons: string[]
          report_count: number
          sticker_url: string
          user_id: string
        }[]
      }
      grant_pro_reward: {
        Args: {
          p_days: number
          p_kind: string
          p_source: string
          p_user: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_pro: { Args: { p_user: string }; Returns: boolean }
      remove_post: { Args: { p_post: string }; Returns: undefined }
      report_post: {
        Args: { p_note?: string; p_post: string; p_reason: string }
        Returns: undefined
      }
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

