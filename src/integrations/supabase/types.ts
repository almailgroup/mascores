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
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          category: string | null
          country: string | null
          created_at: string
          description: string | null
          ends_on: string | null
          featured: boolean
          format: string
          id: string
          logo_url: string | null
          name: string
          season: string | null
          slug: string
          sort_order: number
          sport: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          featured?: boolean
          format?: string
          id?: string
          logo_url?: string | null
          name: string
          season?: string | null
          slug: string
          sort_order?: number
          sport?: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          featured?: boolean
          format?: string
          id?: string
          logo_url?: string | null
          name?: string
          season?: string | null
          slug?: string
          sort_order?: number
          sport?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          assist_player_id: string | null
          created_at: string
          description: string | null
          extra: number | null
          id: string
          match_id: string
          minute: number | null
          player_id: string | null
          sub_out_player_id: string | null
          team_id: string | null
          type: string
        }
        Insert: {
          assist_player_id?: string | null
          created_at?: string
          description?: string | null
          extra?: number | null
          id?: string
          match_id: string
          minute?: number | null
          player_id?: string | null
          sub_out_player_id?: string | null
          team_id?: string | null
          type: string
        }
        Update: {
          assist_player_id?: string | null
          created_at?: string
          description?: string | null
          extra?: number | null
          id?: string
          match_id?: string
          minute?: number | null
          player_id?: string | null
          sub_out_player_id?: string | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_sub_out_player_id_fkey"
            columns: ["sub_out_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          id: string
          is_starting: boolean
          match_id: string
          player_id: string
          position_code: string | null
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_starting?: boolean
          match_id: string
          player_id: string
          position_code?: string | null
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_starting?: boolean
          match_id?: string
          player_id?: string
          position_code?: string | null
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_pen: number | null
          away_score: number | null
          away_team_id: string | null
          city: string | null
          competition_id: string
          created_at: string
          home_pen: number | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          live_minute: number | null
          notes: string | null
          round: string | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_pen?: number | null
          away_score?: number | null
          away_team_id?: string | null
          city?: string | null
          competition_id: string
          created_at?: string
          home_pen?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          live_minute?: number | null
          notes?: string | null
          round?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_pen?: number | null
          away_score?: number | null
          away_team_id?: string | null
          city?: string | null
          competition_id?: string
          created_at?: string
          home_pen?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          live_minute?: number | null
          notes?: string | null
          round?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_display: string | null
          body_markdown: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_display?: string | null
          body_markdown?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_display?: string | null
          body_markdown?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          dob: string | null
          height_cm: number | null
          id: string
          name: string
          nationality: string | null
          photo_url: string | null
          position: string | null
          shirt_number: number | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          height_cm?: number | null
          id?: string
          name: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          height_cm?: number | null
          id?: string
          name?: string
          nationality?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          favorite_competition_ids: string[]
          favorite_player_ids: string[]
          favorite_team_ids: string[]
          id: string
          language: string
          notification_preferences: Json
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favorite_competition_ids?: string[]
          favorite_player_ids?: string[]
          favorite_team_ids?: string[]
          id: string
          language?: string
          notification_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favorite_competition_ids?: string[]
          favorite_player_ids?: string[]
          favorite_team_ids?: string[]
          id?: string
          language?: string
          notification_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      standings_rows: {
        Row: {
          competition_id: string
          drawn: number
          ga: number
          gf: number
          group_label: string | null
          id: string
          lost: number
          played: number
          points: number
          points_adjust: number
          qualification_color: string | null
          qualification_label: string | null
          sort_order: number
          team_id: string
          updated_at: string
          won: number
        }
        Insert: {
          competition_id: string
          drawn?: number
          ga?: number
          gf?: number
          group_label?: string | null
          id?: string
          lost?: number
          played?: number
          points?: number
          points_adjust?: number
          qualification_color?: string | null
          qualification_label?: string | null
          sort_order?: number
          team_id: string
          updated_at?: string
          won?: number
        }
        Update: {
          competition_id?: string
          drawn?: number
          ga?: number
          gf?: number
          group_label?: string | null
          id?: string
          lost?: number
          played?: number
          points?: number
          points_adjust?: number
          qualification_color?: string | null
          qualification_label?: string | null
          sort_order?: number
          team_id?: string
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_rows_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_rows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_name: string | null
          coach_photo_url: string | null
          competition_id: string | null
          country: string | null
          created_at: string
          group_label: string | null
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
          updated_at: string
          venue_city: string | null
          venue_name: string | null
        }
        Insert: {
          coach_name?: string | null
          coach_photo_url?: string | null
          competition_id?: string | null
          country?: string | null
          created_at?: string
          group_label?: string | null
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Update: {
          coach_name?: string | null
          coach_photo_url?: string | null
          competition_id?: string | null
          country?: string | null
          created_at?: string
          group_label?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_admin: { Args: { _uid: string }; Returns: undefined }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      recompute_standings: { Args: { _comp: string }; Returns: undefined }
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
