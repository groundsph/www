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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      avatar_deletion_queue: {
        Row: {
          avatar_url: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          avatar_url: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          category: Database["public"]["Enums"]["badge_category"]
          created_at: string | null
          description: string
          id: string
          image_url: string
          metadata: Json | null
          name: string
          rarity: Database["public"]["Enums"]["badge_rarity"]
        }
        Insert: {
          category: Database["public"]["Enums"]["badge_category"]
          created_at?: string | null
          description: string
          id?: string
          image_url: string
          metadata?: Json | null
          name: string
          rarity: Database["public"]["Enums"]["badge_rarity"]
        }
        Update: {
          category?: Database["public"]["Enums"]["badge_category"]
          created_at?: string | null
          description?: string
          id?: string
          image_url?: string
          metadata?: Json | null
          name?: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
        }
        Relationships: []
      }
      cafe_edit_suggestions: {
        Row: {
          admin_notes: string | null
          cafe_id: string
          created_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_changes: Json
          suggested_images: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          cafe_id: string
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_changes: Json
          suggested_images?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          cafe_id?: string
          created_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_changes?: Json
          suggested_images?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_edit_suggestions_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_edit_suggestions_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_edit_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_edit_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_menus: {
        Row: {
          cafe_id: string
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_signature: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          cafe_id: string
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_signature?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          cafe_id?: string
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_signature?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menus_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_menus_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_rating_stats: {
        Row: {
          average_rating: number | null
          cafe_id: string
          last_updated: string | null
          rating_distribution: Json | null
          total_reviews: number | null
        }
        Insert: {
          average_rating?: number | null
          cafe_id: string
          last_updated?: string | null
          rating_distribution?: Json | null
          total_reviews?: number | null
        }
        Update: {
          average_rating?: number | null
          cafe_id?: string
          last_updated?: string | null
          rating_distribution?: Json | null
          total_reviews?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_rating_stats_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_rating_stats_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_stories: {
        Row: {
          cafe_id: string
          content: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          cafe_id: string
          content: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          cafe_id?: string
          content?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_stories_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_stories_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafes: {
        Row: {
          address_display: string
          area: string | null
          brew_methods: string[] | null
          city_municipality: string
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_sockets: boolean | null
          has_wifi: boolean | null
          id: string
          is_active: boolean | null
          is_claimed: boolean | null
          is_pet_friendly: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          is_work_friendly: boolean | null
          lat: number
          lng: number
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          name: string
          operating_hours: Json | null
          owner_ids: string[] | null
          payment_methods: string | null
          phone: string | null
          price_level: Database["public"]["Enums"]["price_level"]
          province: string
          region: string
          roaster: string | null
          search_vector: unknown
          serves_food: boolean | null
          slug: string
          socials: Json | null
          specialty: string[] | null
          tags: string[] | null
          thumbnail: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          address_display: string
          area?: string | null
          brew_methods?: string[] | null
          city_municipality: string
          contributor_id?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          featured_until?: string | null
          gallery?: string[] | null
          has_aircon?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_sockets?: boolean | null
          has_wifi?: boolean | null
          id?: string
          is_active?: boolean | null
          is_claimed?: boolean | null
          is_pet_friendly?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          is_work_friendly?: boolean | null
          lat: number
          lng: number
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          name: string
          operating_hours?: Json | null
          owner_ids?: string[] | null
          payment_methods?: string | null
          phone?: string | null
          price_level: Database["public"]["Enums"]["price_level"]
          province: string
          region: string
          roaster?: string | null
          search_vector?: unknown
          serves_food?: boolean | null
          slug: string
          socials?: Json | null
          specialty?: string[] | null
          tags?: string[] | null
          thumbnail: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          address_display?: string
          area?: string | null
          brew_methods?: string[] | null
          city_municipality?: string
          contributor_id?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          featured_until?: string | null
          gallery?: string[] | null
          has_aircon?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_sockets?: boolean | null
          has_wifi?: boolean | null
          id?: string
          is_active?: boolean | null
          is_claimed?: boolean | null
          is_pet_friendly?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          is_work_friendly?: boolean | null
          lat?: number
          lng?: number
          membership_tier?:
            | Database["public"]["Enums"]["membership_tier"]
            | null
          name?: string
          operating_hours?: Json | null
          owner_ids?: string[] | null
          payment_methods?: string | null
          phone?: string | null
          price_level?: Database["public"]["Enums"]["price_level"]
          province?: string
          region?: string
          roaster?: string | null
          search_vector?: unknown
          serves_food?: boolean | null
          slug?: string
          socials?: Json | null
          specialty?: string[] | null
          tags?: string[] | null
          thumbnail?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafes_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_schedules: {
        Row: {
          cafe_id: string
          created_at: string | null
          custom_description: string | null
          custom_image: string | null
          custom_title: string | null
          end_date: string
          id: string
          is_active: boolean | null
          priority: number | null
          region_context: string | null
          slot_type: Database["public"]["Enums"]["slot_type"]
          start_date: string
        }
        Insert: {
          cafe_id: string
          created_at?: string | null
          custom_description?: string | null
          custom_image?: string | null
          custom_title?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          region_context?: string | null
          slot_type: Database["public"]["Enums"]["slot_type"]
          start_date: string
        }
        Update: {
          cafe_id?: string
          created_at?: string | null
          custom_description?: string | null
          custom_image?: string | null
          custom_title?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          region_context?: string | null
          slot_type?: Database["public"]["Enums"]["slot_type"]
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_schedules_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_schedules_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_supporter: boolean | null
          passport: Json | null
          profile_completed: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          stats: Json | null
          support_since: string | null
          total_contribution: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id: string
          is_supporter?: boolean | null
          passport?: Json | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stats?: Json | null
          support_since?: string | null
          total_contribution?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_supporter?: boolean | null
          passport?: Json | null
          profile_completed?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stats?: Json | null
          support_since?: string | null
          total_contribution?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      review_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_interactions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          cafe_id: string
          comment: string
          created_at: string | null
          id: string
          images: string[] | null
          is_edited: boolean | null
          is_verified_visit: boolean | null
          likes_count: number | null
          rating: number
          status: Database["public"]["Enums"]["review_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cafe_id: string
          comment: string
          created_at?: string | null
          id?: string
          images?: string[] | null
          is_edited?: boolean | null
          is_verified_visit?: boolean | null
          likes_count?: number | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cafe_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          images?: string[] | null
          is_edited?: boolean | null
          is_verified_visit?: boolean | null
          likes_count?: number | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          badge_id: string
          evidence_url: string | null
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          badge_id: string
          evidence_url?: string | null
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          badge_id?: string
          evidence_url?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cafe_with_ratings: {
        Row: {
          address_display: string | null
          average_rating: number | null
          brew_methods: string[] | null
          city_municipality: string | null
          contributor_id: string | null
          created_at: string | null
          description: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_sockets: boolean | null
          has_wifi: boolean | null
          id: string | null
          is_active: boolean | null
          is_claimed: boolean | null
          is_pet_friendly: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          is_work_friendly: boolean | null
          lat: number | null
          lng: number | null
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          name: string | null
          owner_ids: string[] | null
          price_level: Database["public"]["Enums"]["price_level"] | null
          province: string | null
          rating_distribution: Json | null
          region: string | null
          roaster: string | null
          search_vector: unknown
          slug: string | null
          thumbnail: string | null
          total_reviews: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafes_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_cafes_in_bounds: {
        Args: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number }
        Returns: {
          address_display: string
          area: string | null
          brew_methods: string[] | null
          city_municipality: string
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_sockets: boolean | null
          has_wifi: boolean | null
          id: string
          is_active: boolean | null
          is_claimed: boolean | null
          is_pet_friendly: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          is_work_friendly: boolean | null
          lat: number
          lng: number
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          name: string
          operating_hours: Json | null
          owner_ids: string[] | null
          payment_methods: string | null
          phone: string | null
          price_level: Database["public"]["Enums"]["price_level"]
          province: string
          region: string
          roaster: string | null
          search_vector: unknown
          serves_food: boolean | null
          slug: string
          socials: Json | null
          specialty: string[] | null
          tags: string[] | null
          thumbnail: string
          updated_at: string | null
          website_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cafes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_cafes: {
        Args: { query_text: string }
        Returns: {
          address_display: string
          area: string | null
          brew_methods: string[] | null
          city_municipality: string
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_sockets: boolean | null
          has_wifi: boolean | null
          id: string
          is_active: boolean | null
          is_claimed: boolean | null
          is_pet_friendly: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          is_work_friendly: boolean | null
          lat: number
          lng: number
          membership_tier: Database["public"]["Enums"]["membership_tier"] | null
          name: string
          operating_hours: Json | null
          owner_ids: string[] | null
          payment_methods: string | null
          phone: string | null
          price_level: Database["public"]["Enums"]["price_level"]
          province: string
          region: string
          roaster: string | null
          search_vector: unknown
          serves_food: boolean | null
          slug: string
          socials: Json | null
          specialty: string[] | null
          tags: string[] | null
          thumbnail: string
          updated_at: string | null
          website_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cafes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      badge_category: "achievement" | "monetary" | "social"
      badge_rarity: "common" | "rare" | "legendary"
      interaction_type: "like" | "report"
      membership_tier: "free" | "basic" | "premium"
      price_level: "low" | "medium" | "high"
      review_status: "published" | "hidden" | "flagged"
      scout_rank: "novice" | "expert" | "vanguard"
      slot_type: "hero" | "sidebar" | "collection" | "regional_spotlight"
      user_role: "user" | "moderator" | "admin"
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
    Enums: {
      badge_category: ["achievement", "monetary", "social"],
      badge_rarity: ["common", "rare", "legendary"],
      interaction_type: ["like", "report"],
      membership_tier: ["free", "basic", "premium"],
      price_level: ["low", "medium", "high"],
      review_status: ["published", "hidden", "flagged"],
      scout_rank: ["novice", "expert", "vanguard"],
      slot_type: ["hero", "sidebar", "collection", "regional_spotlight"],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const
