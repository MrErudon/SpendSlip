// Core domain types for SpendSlip, mirroring the Supabase schema
// (see supabase/migrations/0001_init.sql).

export type Recurrence = "monthly" | "biweekly" | "weekly" | "annual";

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export type IncomeMode = "hourly" | "salary";

export type FilingStatus = "single" | "married_joint" | "married_separate" | "head_of_household";

export type MemberRole = "owner" | "editor" | "viewer";

export type InviteStatus = "pending" | "accepted" | "declined";

export interface BudgetProfile {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BillCategory {
  id: string;
  profile_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  profile_id: string;
  category_id: string;
  name: string;
  amount: number;
  due_day: number; // 1-31
  payment_url: string | null;
  recurrence: Recurrence;
  autopay: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillOccurrence {
  id: string;
  bill_id: string;
  profile_id: string;
  due_date: string; // ISO date
  amount: number;
  paid: boolean;
  paid_at: string | null;
  period_key: string; // e.g. "2026-08" for month rollover idempotency
  created_at: string;
  updated_at: string;
}

export interface IncomeSettings {
  id: string;
  profile_id: string;
  mode: IncomeMode;
  hourly_rate: number | null;
  hours_per_week: number | null;
  annual_salary: number | null;
  manual_ot_rate: number | null;
  additional_income: number;
  filing_status: FilingStatus;
  state_rate: number;
  flat_rate_override: number | null;
  savings_goal: number;
  hours_worked_this_period: number;
  created_at: string;
  updated_at: string;
}

export interface Paycheck {
  id: string;
  profile_id: string;
  date: string; // ISO date
  amount: number;
  label: string | null;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillPaycheckAllocation {
  id: string;
  paycheck_id: string;
  bill_id: string;
  occurrence_id: string | null;
  amount: number;
  created_at: string;
}

export interface SharedBudget {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  goal_label: string | null;
  goal_amount: number | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedBudgetMember {
  id: string;
  budget_id: string;
  user_id: string | null;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedBudgetIncome {
  id: string;
  budget_id: string;
  member_id: string;
  net_monthly_income: number;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  budget_id: string;
  member_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  email_reminders: boolean;
  reminder_days: number[]; // e.g. [1, 3, 7]
  keep_statement_files: boolean; // default off — see statement-files storage bucket
  created_at: string;
  updated_at: string;
}

export interface TaxBracket {
  id: string;
  year: number;
  filing_status: FilingStatus;
  bracket_order: number;
  min_income: number;
  max_income: number | null;
  rate: number;
}

// Schema reference mirroring supabase/migrations. Not currently threaded
// into the supabase-js client generic (see the note in
// lib/supabase/client.ts) — query results are cast to the Row types above
// at each call site instead. Kept here as living documentation of the
// Insert/Update shapes, in the same explicit style `supabase gen types
// typescript` produces, so it's easy to wire back in later.
export interface Database {
  public: {
    Tables: {
      budget_profiles: {
        Row: BudgetProfile;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          emoji?: string;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          emoji?: string;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bill_categories: {
        Row: BillCategory;
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: Bill;
        Insert: {
          id?: string;
          profile_id: string;
          category_id: string;
          name: string;
          amount: number;
          due_day: number;
          payment_url?: string | null;
          recurrence?: Recurrence;
          autopay?: boolean;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          category_id?: string;
          name?: string;
          amount?: number;
          due_day?: number;
          payment_url?: string | null;
          recurrence?: Recurrence;
          autopay?: boolean;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bill_occurrences: {
        Row: BillOccurrence;
        Insert: {
          id?: string;
          bill_id: string;
          profile_id: string;
          due_date: string;
          amount: number;
          paid?: boolean;
          paid_at?: string | null;
          period_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bill_id?: string;
          profile_id?: string;
          due_date?: string;
          amount?: number;
          paid?: boolean;
          paid_at?: string | null;
          period_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      income_settings: {
        Row: IncomeSettings;
        Insert: {
          id?: string;
          profile_id: string;
          mode?: IncomeMode;
          hourly_rate?: number | null;
          hours_per_week?: number | null;
          annual_salary?: number | null;
          manual_ot_rate?: number | null;
          additional_income?: number;
          filing_status?: FilingStatus;
          state_rate?: number;
          flat_rate_override?: number | null;
          savings_goal?: number;
          hours_worked_this_period?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          mode?: IncomeMode;
          hourly_rate?: number | null;
          hours_per_week?: number | null;
          annual_salary?: number | null;
          manual_ot_rate?: number | null;
          additional_income?: number;
          filing_status?: FilingStatus;
          state_rate?: number;
          flat_rate_override?: number | null;
          savings_goal?: number;
          hours_worked_this_period?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      paychecks: {
        Row: Paycheck;
        Insert: {
          id?: string;
          profile_id: string;
          date: string;
          amount: number;
          label?: string | null;
          is_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          date?: string;
          amount?: number;
          label?: string | null;
          is_manual?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bill_paycheck_allocations: {
        Row: BillPaycheckAllocation;
        Insert: {
          id?: string;
          paycheck_id: string;
          bill_id: string;
          occurrence_id?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          paycheck_id?: string;
          bill_id?: string;
          occurrence_id?: string | null;
          amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      shared_budgets: {
        Row: SharedBudget;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          emoji?: string;
          goal_label?: string | null;
          goal_amount?: number | null;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          emoji?: string;
          goal_label?: string | null;
          goal_amount?: number | null;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shared_budget_members: {
        Row: SharedBudgetMember;
        Insert: {
          id?: string;
          budget_id: string;
          user_id?: string | null;
          email: string;
          role?: MemberRole;
          status?: InviteStatus;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          user_id?: string | null;
          email?: string;
          role?: MemberRole;
          status?: InviteStatus;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shared_budget_income: {
        Row: SharedBudgetIncome;
        Insert: {
          id?: string;
          budget_id: string;
          member_id: string;
          net_monthly_income?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          member_id?: string;
          net_monthly_income?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      goal_contributions: {
        Row: GoalContribution;
        Insert: {
          id?: string;
          budget_id: string;
          member_id: string;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          budget_id?: string;
          member_id?: string;
          amount?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: NotificationSettings;
        Insert: {
          id?: string;
          user_id: string;
          email_reminders?: boolean;
          reminder_days?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email_reminders?: boolean;
          reminder_days?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tax_brackets: {
        Row: TaxBracket;
        Insert: {
          id?: string;
          year: number;
          filing_status: FilingStatus;
          bracket_order: number;
          min_income: number;
          max_income?: number | null;
          rate: number;
        };
        Update: {
          id?: string;
          year?: number;
          filing_status?: FilingStatus;
          bracket_order?: number;
          min_income?: number;
          max_income?: number | null;
          rate?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
