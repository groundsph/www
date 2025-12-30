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
      blog_posts: {
        Row: {
          author_id: string
          cafe_id: string | null
          category: Database["public"]["Enums"]["blog_category"]
          content: string
          cover_image: string | null
          created_at: string | null
          excerpt: string | null
          featured: boolean | null
          id: string
          published_at: string | null
          search_vector: unknown
          slug: string
          status: Database["public"]["Enums"]["blog_status"]
          tags: string[] | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_id: string
          cafe_id?: string | null
          category?: Database["public"]["Enums"]["blog_category"]
          content: string
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          published_at?: string | null
          search_vector?: unknown
          slug: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[] | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_id?: string
          cafe_id?: string | null
          category?: Database["public"]["Enums"]["blog_category"]
          content?: string
          cover_image?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          published_at?: string | null
          search_vector?: unknown
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_reports: {
        Row: {
          admin_notes: string | null
          blog_post_id: string
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          blog_post_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          blog_post_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_reports_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_claims: {
        Row: {
          admin_notes: string | null
          cafe_id: string
          created_at: string | null
          id: string
          proof_document_url: string | null
          proof_text: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          cafe_id: string
          created_at?: string | null
          id?: string
          proof_document_url?: string | null
          proof_text: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          cafe_id?: string
          created_at?: string | null
          id?: string
          proof_document_url?: string | null
          proof_text?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafe_claims_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_claims_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      cafe_menu_items: {
        Row: {
          cafe_id: string
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_signature: boolean | null
          name: string
          price: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          cafe_id: string
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_signature?: boolean | null
          name: string
          price: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          cafe_id?: string
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_signature?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_menu_items_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_menu_items_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      cafe_page_views: {
        Row: {
          cafe_id: string
          country: string | null
          device_type: string | null
          id: string
          referrer: string | null
          viewed_at: string
          visitor_id: string | null
        }
        Insert: {
          cafe_id: string
          country?: string | null
          device_type?: string | null
          id?: string
          referrer?: string | null
          viewed_at?: string
          visitor_id?: string | null
        }
        Update: {
          cafe_id?: string
          country?: string | null
          device_type?: string | null
          id?: string
          referrer?: string | null
          viewed_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_page_views_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_page_views_cafe_id_fkey"
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
      cafe_subscriptions: {
        Row: {
          cafe_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          helix_subscription_id: string | null
          id: string
          is_manual_payment: boolean | null
          payment_verified: boolean | null
          proof_of_payment_url: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string | null
        }
        Insert: {
          cafe_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          helix_subscription_id?: string | null
          id?: string
          is_manual_payment?: boolean | null
          payment_verified?: boolean | null
          proof_of_payment_url?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string | null
        }
        Update: {
          cafe_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          helix_subscription_id?: string | null
          id?: string
          is_manual_payment?: boolean | null
          payment_verified?: boolean | null
          proof_of_payment_url?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cafe_subscriptions_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cafe_subscriptions_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: true
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
          coffee_style: Database["public"]["Enums"]["coffee_style"] | null
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_bidet: boolean | null
          has_indoor_seating: boolean | null
          has_non_dairy: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_restroom: boolean | null
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
          milk_options: string[] | null
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
          coffee_style?: Database["public"]["Enums"]["coffee_style"] | null
          contributor_id?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          featured_until?: string | null
          gallery?: string[] | null
          has_aircon?: boolean | null
          has_bidet?: boolean | null
          has_indoor_seating?: boolean | null
          has_non_dairy?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_restroom?: boolean | null
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
          milk_options?: string[] | null
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
          coffee_style?: Database["public"]["Enums"]["coffee_style"] | null
          contributor_id?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          featured_until?: string | null
          gallery?: string[] | null
          has_aircon?: boolean | null
          has_bidet?: boolean | null
          has_indoor_seating?: boolean | null
          has_non_dairy?: boolean | null
          has_outdoor_seating?: boolean | null
          has_parking?: boolean | null
          has_restroom?: boolean | null
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
          milk_options?: string[] | null
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
      contribution_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["contribution_action_type"]
          cafe_id: string
          created_at: string | null
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["contribution_action_type"]
          cafe_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["contribution_action_type"]
          cafe_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_logs_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_logs_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          cafe_id: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          is_national: boolean | null
          location_name: string | null
          province: string | null
          region: string | null
          start_date: string
          status: Database["public"]["Enums"]["event_status"] | null
          ticket_link: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cafe_id?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_national?: boolean | null
          location_name?: string | null
          province?: string | null
          region?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["event_status"] | null
          ticket_link?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cafe_id?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_national?: boolean | null
          location_name?: string | null
          province?: string | null
          region?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"] | null
          ticket_link?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
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
      featured_slot_requests: {
        Row: {
          admin_notes: string | null
          cafe_id: string | null
          created_at: string | null
          id: string
          owner_id: string | null
          processed_at: string | null
          requested_month: string
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          cafe_id?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string | null
          processed_at?: string | null
          requested_month: string
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          cafe_id?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string | null
          processed_at?: string | null
          requested_month?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_slot_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_slot_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_review_responses: {
        Row: {
          created_at: string | null
          id: string
          is_edited: boolean | null
          owner_id: string
          response: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          owner_id: string
          response: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          owner_id?: string
          response?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_review_responses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_verification_requests: {
        Row: {
          admin_notes: string | null
          cafe_id: string
          created_at: string | null
          id: string
          notes: string | null
          proof_urls: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          user_id: string
          verification_type: string
        }
        Insert: {
          admin_notes?: string | null
          cafe_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          proof_urls?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id: string
          verification_type: string
        }
        Update: {
          admin_notes?: string | null
          cafe_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          proof_urls?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          user_id?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_verification_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafe_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_verification_requests_cafe_id_fkey"
            columns: ["cafe_id"]
            isOneToOne: false
            referencedRelation: "cafes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          supporter_expires_at: string | null
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
          supporter_expires_at?: string | null
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
          supporter_expires_at?: string | null
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
          is_pinned_by_owner: boolean | null
          is_verified_visit: boolean | null
          likes_count: number | null
          pinned_at: string | null
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
          is_pinned_by_owner?: boolean | null
          is_verified_visit?: boolean | null
          likes_count?: number | null
          pinned_at?: string | null
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
          is_pinned_by_owner?: boolean | null
          is_verified_visit?: boolean | null
          likes_count?: number | null
          pinned_at?: string | null
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
      supporter_subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          email: string
          from_name: string
          id: string
          is_first_subscription: boolean | null
          is_subscription: boolean | null
          kofi_transaction_id: string
          message: string | null
          tier_name: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          email: string
          from_name: string
          id?: string
          is_first_subscription?: boolean | null
          is_subscription?: boolean | null
          kofi_transaction_id: string
          message?: string | null
          tier_name?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          email?: string
          from_name?: string
          id?: string
          is_first_subscription?: boolean | null
          is_subscription?: boolean | null
          kofi_transaction_id?: string
          message?: string | null
          tier_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supporter_subscriptions_user_id_fkey"
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
      admin_get_stats: { Args: never; Returns: Json }
      approve_cafe_claim: {
        Args: { admin_id: string; claim_id: string; notes?: string }
        Returns: boolean
      }
      can_add_menu_item: { Args: { p_cafe_id: string }; Returns: boolean }
      count_cafe_menu_items: { Args: { p_cafe_id: string }; Returns: number }
      get_admin_stats: { Args: never; Returns: Json }
      get_cafe_tier: {
        Args: { p_cafe_id: string }
        Returns: Database["public"]["Enums"]["membership_tier"]
      }
      get_cafes_in_bounds: {
        Args: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number }
        Returns: {
          address_display: string
          area: string | null
          brew_methods: string[] | null
          city_municipality: string
          coffee_style: Database["public"]["Enums"]["coffee_style"] | null
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_bidet: boolean | null
          has_indoor_seating: boolean | null
          has_non_dairy: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_restroom: boolean | null
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
          milk_options: string[] | null
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
      is_cafe_owner: {
        Args: { p_cafe_id: string; p_user_id: string }
        Returns: boolean
      }
      search_cafes: {
        Args: { query_text: string }
        Returns: {
          address_display: string
          area: string | null
          brew_methods: string[] | null
          city_municipality: string
          coffee_style: Database["public"]["Enums"]["coffee_style"] | null
          contributor_id: string | null
          created_at: string | null
          description: string | null
          email: string | null
          featured_until: string | null
          gallery: string[] | null
          has_aircon: boolean | null
          has_bidet: boolean | null
          has_indoor_seating: boolean | null
          has_non_dairy: boolean | null
          has_outdoor_seating: boolean | null
          has_parking: boolean | null
          has_restroom: boolean | null
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
          milk_options: string[] | null
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
      blog_category:
        | "news"
        | "guides"
        | "events"
        | "promotions"
        | "community"
        | "cafe_update"
      blog_status: "draft" | "published" | "archived"
      coffee_style: "classic" | "artisan"
      contribution_action_type:
        | "CREATE"
        | "UPDATE"
        | "VERIFY"
        | "MEDIA"
        | "SUGGEST"
      event_status: "draft" | "published" | "cancelled"
      interaction_type: "like" | "report"
      membership_tier: "free" | "basic" | "premium"
      price_level: "low" | "medium" | "high"
      review_status: "published" | "hidden" | "flagged"
      scout_rank: "novice" | "expert" | "vanguard"
      slot_type: "hero" | "sidebar" | "collection" | "regional_spotlight"
      subscription_status: "active" | "cancelled" | "past_due" | "trialing"
      user_role: "user" | "writer" | "moderator" | "admin"
      verification_status: "pending" | "approved" | "rejected"
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
      blog_category: [
        "news",
        "guides",
        "events",
        "promotions",
        "community",
        "cafe_update",
      ],
      blog_status: ["draft", "published", "archived"],
      coffee_style: ["classic", "artisan"],
      contribution_action_type: [
        "CREATE",
        "UPDATE",
        "VERIFY",
        "MEDIA",
        "SUGGEST",
      ],
      event_status: ["draft", "published", "cancelled"],
      interaction_type: ["like", "report"],
      membership_tier: ["free", "basic", "premium"],
      price_level: ["low", "medium", "high"],
      review_status: ["published", "hidden", "flagged"],
      scout_rank: ["novice", "expert", "vanguard"],
      slot_type: ["hero", "sidebar", "collection", "regional_spotlight"],
      subscription_status: ["active", "cancelled", "past_due", "trialing"],
      user_role: ["user", "writer", "moderator", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
