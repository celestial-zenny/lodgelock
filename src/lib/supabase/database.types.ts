// Generated from the live Supabase schema (project lodgelock) through migration 0003.
// Regenerate after migrations; do not edit by hand.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: number
          reason: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: never
          reason?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: never
          reason?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["booking_status"]
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["booking_status"]
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["booking_status"]
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: []
      }
      bookings: {
        Row: {
          agent_commission_kobo: number
          agent_fee_kobo: number
          agent_id: string | null
          auto_release_at: string | null
          cancellation_kind: string | null
          cancelled_at: string | null
          commitment_fee_kobo: number
          created_at: string
          handover_at: string | null
          handover_by: string | null
          id: string
          lodge_id: string
          move_in_date: string
          paid_at: string | null
          payment_ref: string | null
          renewal_of: string | null
          rent_kobo: number
          status: Database["public"]["Enums"]["booking_status"]
          student_confirmed_at: string | null
          student_id: string
          total_kobo: number | null
          updated_at: string
        }
        Insert: {
          agent_commission_kobo?: number
          agent_fee_kobo: number
          agent_id?: string | null
          auto_release_at?: string | null
          cancellation_kind?: string | null
          cancelled_at?: string | null
          commitment_fee_kobo?: number
          created_at?: string
          handover_at?: string | null
          handover_by?: string | null
          id?: string
          lodge_id: string
          move_in_date: string
          paid_at?: string | null
          payment_ref?: string | null
          renewal_of?: string | null
          rent_kobo: number
          status?: Database["public"]["Enums"]["booking_status"]
          student_confirmed_at?: string | null
          student_id: string
          total_kobo?: number | null
          updated_at?: string
        }
        Update: {
          agent_commission_kobo?: number
          agent_fee_kobo?: number
          agent_id?: string | null
          auto_release_at?: string | null
          cancellation_kind?: string | null
          cancelled_at?: string | null
          commitment_fee_kobo?: number
          created_at?: string
          handover_at?: string | null
          handover_by?: string | null
          id?: string
          lodge_id?: string
          move_in_date?: string
          paid_at?: string | null
          payment_ref?: string | null
          renewal_of?: string | null
          rent_kobo?: number
          status?: Database["public"]["Enums"]["booking_status"]
          student_confirmed_at?: string | null
          student_id?: string
          total_kobo?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lodge_id_fkey"
            columns: ["lodge_id"]
            isOneToOne: false
            referencedRelation: "lodges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          granted_at: string
          id: string
          policy_version: string
          purpose: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          granted_at?: string
          id?: string
          policy_version: string
          purpose: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          granted_at?: string
          id?: string
          policy_version?: string
          purpose?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          raised_by: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          raised_by: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          raised_by?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_consents: {
        Row: {
          attested_at: string
          confirmed_at: string | null
          guardian_name: string
          guardian_phone: string
          id: string
          relationship: string
          user_id: string
        }
        Insert: {
          attested_at?: string
          confirmed_at?: string | null
          guardian_name: string
          guardian_phone: string
          id?: string
          relationship: string
          user_id: string
        }
        Update: {
          attested_at?: string
          confirmed_at?: string | null
          guardian_name?: string
          guardian_phone?: string
          id?: string
          relationship?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          checklist: Json
          created_at: string
          id: string
          lodge_id: string
          notes: string | null
          scout_id: string
          status: Database["public"]["Enums"]["inspection_status"]
          submitted_at: string | null
        }
        Insert: {
          checklist?: Json
          created_at?: string
          id?: string
          lodge_id: string
          notes?: string | null
          scout_id: string
          status?: Database["public"]["Enums"]["inspection_status"]
          submitted_at?: string | null
        }
        Update: {
          checklist?: Json
          created_at?: string
          id?: string
          lodge_id?: string
          notes?: string | null
          scout_id?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_lodge_id_fkey"
            columns: ["lodge_id"]
            isOneToOne: false
            referencedRelation: "lodges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_reviews: {
        Row: {
          admin_note: string | null
          all_passed: boolean | null
          bank_passed: boolean | null
          bvn_passed: boolean | null
          decided_at: string | null
          decided_by: string | null
          id: string
          nin_passed: boolean | null
          status: Database["public"]["Enums"]["kyc_review_status"]
          subject_id: string
          submitted_at: string
        }
        Insert: {
          admin_note?: string | null
          all_passed?: boolean | null
          bank_passed?: boolean | null
          bvn_passed?: boolean | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          nin_passed?: boolean | null
          status?: Database["public"]["Enums"]["kyc_review_status"]
          subject_id: string
          submitted_at?: string
        }
        Update: {
          admin_note?: string | null
          all_passed?: boolean | null
          bank_passed?: boolean | null
          bvn_passed?: boolean | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          nin_passed?: boolean | null
          status?: Database["public"]["Enums"]["kyc_review_status"]
          subject_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_reviews_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          check_type: Database["public"]["Enums"]["kyc_check"]
          consent_id: string
          id: string
          passed: boolean
          provider: string
          provider_ref: string | null
          subject_id: string
          verified_at: string
        }
        Insert: {
          check_type: Database["public"]["Enums"]["kyc_check"]
          consent_id: string
          id?: string
          passed: boolean
          provider?: string
          provider_ref?: string | null
          subject_id: string
          verified_at?: string
        }
        Update: {
          check_type?: Database["public"]["Enums"]["kyc_check"]
          consent_id?: string
          id?: string
          passed?: boolean
          provider?: string
          provider_ref?: string | null
          subject_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_verifications_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_verifications_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount_kobo: number
          booking_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          external_ref: string | null
          id: number
          txn_id: string
        }
        Insert: {
          account: string
          amount_kobo: number
          booking_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          external_ref?: string | null
          id?: never
          txn_id: string
        }
        Update: {
          account?: string
          amount_kobo?: number
          booking_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          external_ref?: string | null
          id?: never
          txn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lodge_photos: {
        Row: {
          created_at: string
          id: string
          lodge_id: string
          position: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          lodge_id: string
          position?: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          lodge_id?: string
          position?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodge_photos_lodge_id_fkey"
            columns: ["lodge_id"]
            isOneToOne: false
            referencedRelation: "lodges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodge_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lodges: {
        Row: {
          address: string
          agent_fee_kobo: number
          agent_id: string | null
          amenities: string[]
          area: string
          caretaker_id: string | null
          commitment_fee_pct: number
          created_at: string
          description: string
          distance_to_gate_m: number | null
          id: string
          is_demo: boolean
          landlord_commission_pct: number
          nearest_gate: string | null
          owner_id: string
          rent_kobo: number
          review_note: string | null
          room_type: Database["public"]["Enums"]["room_type"]
          submitted_at: string | null
          status: Database["public"]["Enums"]["lodge_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          agent_fee_kobo?: number
          agent_id?: string | null
          amenities?: string[]
          area: string
          caretaker_id?: string | null
          commitment_fee_pct?: number
          created_at?: string
          description?: string
          distance_to_gate_m?: number | null
          id?: string
          is_demo?: boolean
          landlord_commission_pct?: number
          nearest_gate?: string | null
          owner_id: string
          rent_kobo: number
          review_note?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          submitted_at?: string | null
          status?: Database["public"]["Enums"]["lodge_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          agent_fee_kobo?: number
          agent_id?: string | null
          amenities?: string[]
          area?: string
          caretaker_id?: string | null
          commitment_fee_pct?: number
          created_at?: string
          description?: string
          distance_to_gate_m?: number | null
          id?: string
          is_demo?: boolean
          landlord_commission_pct?: number
          nearest_gate?: string | null
          owner_id?: string
          rent_kobo?: number
          review_note?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          submitted_at?: string | null
          status?: Database["public"]["Enums"]["lodge_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodges_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodges_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payee_mandates: {
        Row: {
          agent_id: string
          id: string
          landlord_id: string
          lodge_id: string
          policy_version: string
          revoked_at: string | null
          signed_at: string
        }
        Insert: {
          agent_id: string
          id?: string
          landlord_id: string
          lodge_id: string
          policy_version: string
          revoked_at?: string | null
          signed_at?: string
        }
        Update: {
          agent_id?: string
          id?: string
          landlord_id?: string
          lodge_id?: string
          policy_version?: string
          revoked_at?: string | null
          signed_at?: string
        }
        Relationships: []
      }
      payment_attempts: {
        Row: {
          amount_kobo: number
          booking_id: string
          created_at: string
          id: string
          last_response_code: string | null
          provider: string
          provider_payment_ref: string | null
          settled_at: string | null
          status: string
          txn_ref: string
        }
        Insert: {
          amount_kobo: number
          booking_id: string
          created_at?: string
          id?: string
          last_response_code?: string | null
          provider?: string
          provider_payment_ref?: string | null
          settled_at?: string | null
          status?: string
          txn_ref: string
        }
        Update: {
          amount_kobo?: number
          booking_id?: string
          created_at?: string
          id?: string
          last_response_code?: string | null
          provider?: string
          provider_payment_ref?: string | null
          settled_at?: string | null
          status?: string
          txn_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_instructions: {
        Row: {
          amount_kobo: number
          booking_id: string
          created_at: string
          id: string
          kind: string
          payee_id: string
          status: string
          txn_id: string
        }
        Insert: {
          amount_kobo: number
          booking_id: string
          created_at?: string
          id?: string
          kind: string
          payee_id: string
          status?: string
          txn_id: string
        }
        Update: {
          amount_kobo?: number
          booking_id?: string
          created_at?: string
          id?: string
          kind?: string
          payee_id?: string
          status?: string
          txn_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          guardian_consent_at: string | null
          id: string
          identity_verified_at: string | null
          is_adult: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name: string
          guardian_consent_at?: string | null
          id: string
          identity_verified_at?: string | null
          is_adult: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          guardian_consent_at?: string | null
          id?: string
          identity_verified_at?: string | null
          is_adult?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          booking_id: string
          created_at: string
          id: string
          lodge_id: string
          rating: number
          student_id: string
        }
        Insert: {
          body?: string | null
          booking_id: string
          created_at?: string
          id?: string
          lodge_id: string
          rating: number
          student_id: string
        }
        Update: {
          body?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          lodge_id?: string
          rating?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_lodge_id_fkey"
            columns: ["lodge_id"]
            isOneToOne: false
            referencedRelation: "lodges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_ref: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_ref: string
          id?: never
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_ref?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_lodge_photo: { Args: { p_lodge: string; p_path: string }; Returns: string }
      create_lodge: {
        Args: {
          p_address: string
          p_agent_fee_kobo: number
          p_amenities: string[]
          p_area: string
          p_commitment_fee_pct: number
          p_description: string
          p_distance_to_gate_m: number | null
          p_landlord_commission_pct: number
          p_nearest_gate: string | null
          p_partner_email?: string | null
          p_policy_version?: string | null
          p_rent_kobo: number
          p_rent_to_agent?: boolean
          p_room_type: Database["public"]["Enums"]["room_type"]
          p_title: string
        }
        Returns: string
      }
      remove_lodge_photo: { Args: { p_photo: string }; Returns: string }
      review_lodge: { Args: { p_approve: boolean; p_lodge: string; p_note?: string | null }; Returns: undefined }
      submit_lodge: { Args: { p_lodge: string }; Returns: undefined }
      begin_payment: {
        Args: { p_booking: string }
        Returns: { amount_kobo: number; txn_ref: string }[]
      }
      cancel_booking: { Args: { p_booking: string }; Returns: string }
      create_booking: {
        Args: { p_lodge: string; p_move_in_date: string; p_renewal_of?: string }
        Returns: string
      }
      decide_kyc_review: {
        Args: { p_approve: boolean; p_note?: string; p_review: string }
        Returns: undefined
      }
      kyc_begin_check: { Args: never; Returns: undefined }
      kyc_grant_consent: {
        Args: { p_policy_version: string }
        Returns: {
          bank_consent: string
          bvn_consent: string
          nin_consent: string
        }[]
      }
      record_kyc_submission: {
        Args: {
          p_bank_consent: string
          p_bank_passed: boolean
          p_bvn_consent: string
          p_bvn_passed: boolean
          p_nin_consent: string
          p_nin_passed: boolean
          p_subject: string
        }
        Returns: string
      }
      record_payment: {
        Args: { p_amount_kobo: number | null; p_provider_ref: string | null; p_response_code: string | null; p_txn_ref: string }
        Returns: string
      }
      run_booking_deadlines: { Args: never; Returns: Json }
      confirm_move_in: {
        Args: { p_booking: string }
        Returns: Database["public"]["Enums"]["booking_status"]
      }
      mark_handover: {
        Args: { p_booking: string }
        Returns: Database["public"]["Enums"]["booking_status"]
      }
      revoke_payee_mandate: { Args: { p_lodge: string }; Returns: undefined }
      set_lodge_caretaker: {
        Args: { p_email: string | null; p_lodge: string }
        Returns: undefined
      }
      sign_payee_mandate: {
        Args: { p_agent: string; p_lodge: string; p_policy_version: string }
        Returns: string
      }
      lodge_trust: {
        Args: { p_lodge_ids: string[] }
        Returns: {
          agent_first_name: string
          agent_verified: boolean
          checklist: Json
          inspected_at: string
          lodge_id: string
          owner_first_name: string
          owner_role: Database["public"]["Enums"]["user_role"]
          owner_verified: boolean
        }[]
      }
      raise_dispute: {
        Args: { p_booking: string; p_reason: string }
        Returns: string
      }
    }
    Enums: {
      booking_status:
        | "DRAFT"
        | "PAID_HELD"
        | "MOVE_IN_CONFIRMED"
        | "DISPUTED"
        | "AUTO_CONFIRMED"
        | "REFUNDED"
        | "PAID_OUT"
        | "CANCELLED"
        | "STUDENT_CANCELLED"
      dispute_status: "open" | "resolved_refund" | "resolved_payout"
      inspection_status: "assigned" | "submitted" | "approved" | "rejected"
      kyc_check: "nin" | "bvn_match" | "bank_account"
      kyc_review_status: "pending" | "approved" | "rejected"
      ledger_direction: "debit" | "credit"
      lodge_status: "draft" | "pending_review" | "verified" | "suspended"
      room_type: "single_room" | "self_contain" | "room_and_parlour" | "flat"
      user_role: "student" | "landlord" | "agent" | "scout" | "admin" | "caretaker"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "DRAFT",
        "PAID_HELD",
        "MOVE_IN_CONFIRMED",
        "DISPUTED",
        "AUTO_CONFIRMED",
        "REFUNDED",
        "PAID_OUT",
        "CANCELLED",
        "STUDENT_CANCELLED",
      ],
      dispute_status: ["open", "resolved_refund", "resolved_payout"],
      inspection_status: ["assigned", "submitted", "approved", "rejected"],
      kyc_check: ["nin", "bvn_match", "bank_account"],
      kyc_review_status: ["pending", "approved", "rejected"],
      ledger_direction: ["debit", "credit"],
      lodge_status: ["draft", "pending_review", "verified", "suspended"],
      room_type: ["single_room", "self_contain", "room_and_parlour", "flat"],
      user_role: ["student", "landlord", "agent", "scout", "admin", "caretaker"],
    },
  },
} as const
