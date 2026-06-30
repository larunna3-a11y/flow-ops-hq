export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          revoked_at: string | null;
          scopes: Json;
          token_hash: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          prefix: string;
          revoked_at?: string | null;
          scopes?: Json;
          token_hash: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          prefix?: string;
          revoked_at?: string | null;
          scopes?: Json;
          token_hash?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_tokens_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          target_id: string | null;
          target_type: string | null;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_rules: {
        Row: {
          category: string;
          channels: Json;
          config: Json;
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          id: string;
          name: string;
          trigger: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          category: string;
          channels?: Json;
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          name: string;
          trigger: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          category?: string;
          channels?: Json;
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          trigger?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_rules_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      backup_runs: {
        Row: {
          bytes: number | null;
          file_url: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          notes: string | null;
          rows: number | null;
          started_at: string;
          started_by: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          bytes?: number | null;
          file_url?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: string;
          notes?: string | null;
          rows?: number | null;
          started_at?: string;
          started_by?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          bytes?: number | null;
          file_url?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          rows?: number | null;
          started_at?: string;
          started_by?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "backup_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      connector_connections: {
        Row: {
          auto_sync: boolean;
          connection_status: string;
          connector_key: string;
          created_at: string;
          created_by: string | null;
          credentials: Json;
          display_name: string;
          id: string;
          last_error: string | null;
          last_error_at: string | null;
          last_sync_at: string | null;
          last_sync_status: string | null;
          oauth_tokens: Json;
          store_id: string | null;
          sync_interval_minutes: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          auto_sync?: boolean;
          connection_status?: string;
          connector_key: string;
          created_at?: string;
          created_by?: string | null;
          credentials?: Json;
          display_name: string;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_sync_at?: string | null;
          last_sync_status?: string | null;
          oauth_tokens?: Json;
          store_id?: string | null;
          sync_interval_minutes?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          auto_sync?: boolean;
          connection_status?: string;
          connector_key?: string;
          created_at?: string;
          created_by?: string | null;
          credentials?: Json;
          display_name?: string;
          id?: string;
          last_error?: string | null;
          last_error_at?: string | null;
          last_sync_at?: string | null;
          last_sync_status?: string | null;
          oauth_tokens?: Json;
          store_id?: string | null;
          sync_interval_minutes?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connector_connections_connector_key_fkey";
            columns: ["connector_key"];
            isOneToOne: false;
            referencedRelation: "connectors";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "connector_connections_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connector_connections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      connector_error_logs: {
        Row: {
          connection_id: string | null;
          connector_key: string;
          context: Json;
          created_at: string;
          error_type: string;
          id: string;
          message: string;
          sync_run_id: string | null;
          workspace_id: string;
        };
        Insert: {
          connection_id?: string | null;
          connector_key: string;
          context?: Json;
          created_at?: string;
          error_type: string;
          id?: string;
          message: string;
          sync_run_id?: string | null;
          workspace_id: string;
        };
        Update: {
          connection_id?: string | null;
          connector_key?: string;
          context?: Json;
          created_at?: string;
          error_type?: string;
          id?: string;
          message?: string;
          sync_run_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connector_error_logs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connector_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connector_error_logs_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connector_error_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      connectors: {
        Row: {
          auth_method: string;
          capabilities: Json;
          category: string;
          created_at: string;
          docs_url: string | null;
          icon_url: string | null;
          id: string;
          key: string;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          auth_method?: string;
          capabilities?: Json;
          category: string;
          created_at?: string;
          docs_url?: string | null;
          icon_url?: string | null;
          id?: string;
          key: string;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          auth_method?: string;
          capabilities?: Json;
          category?: string;
          created_at?: string;
          docs_url?: string | null;
          icon_url?: string | null;
          id?: string;
          key?: string;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      detection_rules: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          is_global: boolean;
          name: string;
          notes: string | null;
          pattern: string;
          priority: number;
          type: string;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          is_global?: boolean;
          name: string;
          notes?: string | null;
          pattern: string;
          priority?: number;
          type: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          is_global?: boolean;
          name?: string;
          notes?: string | null;
          pattern?: string;
          priority?: number;
          type?: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "detection_rules_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      import_logs: {
        Row: {
          created_at: string;
          id: string;
          import_id: string;
          message: string | null;
          order_number: string | null;
          row_number: number | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          import_id: string;
          message?: string | null;
          order_number?: string | null;
          row_number?: number | null;
          status: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          import_id?: string;
          message?: string | null;
          order_number?: string | null;
          row_number?: number | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_logs_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          created_at: string;
          duplicate_count: number;
          failed_count: number;
          filename: string | null;
          id: string;
          imported_by: string | null;
          imported_by_name: string | null;
          status: string;
          success_count: number;
          total_rows: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          duplicate_count?: number;
          failed_count?: number;
          filename?: string | null;
          id?: string;
          imported_by?: string | null;
          imported_by_name?: string | null;
          status?: string;
          success_count?: number;
          total_rows?: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          duplicate_count?: number;
          failed_count?: number;
          filename?: string | null;
          id?: string;
          imported_by?: string | null;
          imported_by_name?: string | null;
          status?: string;
          success_count?: number;
          total_rows?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          account_expires_at: string | null;
          created_at: string;
          email: string | null;
          expires_at: string;
          full_name: string | null;
          id: string;
          invited_by: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["invitation_status"];
          token: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          account_expires_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          token?: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          account_expires_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          token?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          metadata: Json;
          read_at: string | null;
          severity: string;
          title: string;
          type: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json;
          read_at?: string | null;
          severity?: string;
          title: string;
          type: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json;
          read_at?: string | null;
          severity?: string;
          title?: string;
          type?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      order_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          assigned_by_name: string | null;
          created_at: string;
          id: string;
          order_id: string;
          packer_id: string;
          packer_name: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          assigned_by_name?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          packer_id: string;
          packer_name: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          assigned_by_name?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          packer_id?: string;
          packer_name?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_assignments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_name: string;
          product_variant: string | null;
          quantity: number;
          sku: string;
          sku_marketplace: string | null;
          sku_master: string | null;
          updated_at: string;
          warehouse_location: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_name: string;
          product_variant?: string | null;
          quantity?: number;
          sku: string;
          sku_marketplace?: string | null;
          sku_master?: string | null;
          updated_at?: string;
          warehouse_location?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_name?: string;
          product_variant?: string | null;
          quantity?: number;
          sku?: string;
          sku_marketplace?: string | null;
          sku_master?: string | null;
          updated_at?: string;
          warehouse_location?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          assigned_at: string | null;
          assigned_to: string | null;
          assigned_to_name: string | null;
          courier: string | null;
          created_at: string;
          customer_name: string | null;
          customer_phone: string | null;
          id: string;
          marketplace: string | null;
          order_number: string;
          order_status: string;
          ordered_at: string | null;
          packed_at: string | null;
          packed_by: string | null;
          packed_by_name: string | null;
          packing_status: string;
          shipping_status: string;
          store_id: string | null;
          store_name: string | null;
          tracking_number: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          courier?: string | null;
          created_at?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          marketplace?: string | null;
          order_number: string;
          order_status?: string;
          ordered_at?: string | null;
          packed_at?: string | null;
          packed_by?: string | null;
          packed_by_name?: string | null;
          packing_status?: string;
          shipping_status?: string;
          store_id?: string | null;
          store_name?: string | null;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          courier?: string | null;
          created_at?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          marketplace?: string | null;
          order_number?: string;
          order_status?: string;
          ordered_at?: string | null;
          packed_at?: string | null;
          packed_by?: string | null;
          packed_by_name?: string | null;
          packing_status?: string;
          shipping_status?: string;
          store_id?: string | null;
          store_name?: string | null;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      packing_orders: {
        Row: {
          courier: string | null;
          created_at: string;
          id: string;
          marketplace: string | null;
          order_number: string;
          status: string;
          tracking_number: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          courier?: string | null;
          created_at?: string;
          id?: string;
          marketplace?: string | null;
          order_number: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          courier?: string | null;
          created_at?: string;
          id?: string;
          marketplace?: string | null;
          order_number?: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packing_orders_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      packing_records: {
        Row: {
          completion_status: string;
          courier: string | null;
          created_at: string;
          id: string;
          marketplace: string | null;
          missing_quantity: number;
          missing_skus: Json;
          notes: string | null;
          order_number: string | null;
          packing_timestamp: string | null;
          raw_code: string;
          role: string | null;
          scan_timestamp: string;
          status: string;
          tracking_number: string | null;
          updated_at: string;
          user_id: string;
          user_name: string;
          verified_skus: Json;
          workspace_id: string;
        };
        Insert: {
          completion_status?: string;
          courier?: string | null;
          created_at?: string;
          id?: string;
          marketplace?: string | null;
          missing_quantity?: number;
          missing_skus?: Json;
          notes?: string | null;
          order_number?: string | null;
          packing_timestamp?: string | null;
          raw_code: string;
          role?: string | null;
          scan_timestamp?: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          user_id: string;
          user_name: string;
          verified_skus?: Json;
          workspace_id: string;
        };
        Update: {
          completion_status?: string;
          courier?: string | null;
          created_at?: string;
          id?: string;
          marketplace?: string | null;
          missing_quantity?: number;
          missing_skus?: Json;
          notes?: string | null;
          order_number?: string | null;
          packing_timestamp?: string | null;
          raw_code?: string;
          role?: string | null;
          scan_timestamp?: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          user_id?: string;
          user_name?: string;
          verified_skus?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packing_records_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_color: string;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          last_login: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_color?: string;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          last_login?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_color?: string;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          last_login?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          file_url: string | null;
          generated_at: string;
          generated_by: string | null;
          id: string;
          parameters: Json;
          report_type: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          file_url?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          parameters?: Json;
          report_type: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          file_url?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          parameters?: Json;
          report_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      return_items: {
        Row: {
          created_at: string;
          damaged_quantity: number;
          id: string;
          inventory_action: string;
          missing_quantity: number;
          notes: string | null;
          order_item_id: string | null;
          original_quantity: number;
          product_name: string | null;
          product_variant: string | null;
          return_id: string;
          returned_quantity: number;
          sku: string | null;
          updated_at: string;
          workspace_id: string;
          wrong_quantity: number;
        };
        Insert: {
          created_at?: string;
          damaged_quantity?: number;
          id?: string;
          inventory_action?: string;
          missing_quantity?: number;
          notes?: string | null;
          order_item_id?: string | null;
          original_quantity?: number;
          product_name?: string | null;
          product_variant?: string | null;
          return_id: string;
          returned_quantity?: number;
          sku?: string | null;
          updated_at?: string;
          workspace_id: string;
          wrong_quantity?: number;
        };
        Update: {
          created_at?: string;
          damaged_quantity?: number;
          id?: string;
          inventory_action?: string;
          missing_quantity?: number;
          notes?: string | null;
          order_item_id?: string | null;
          original_quantity?: number;
          product_name?: string | null;
          product_variant?: string | null;
          return_id?: string;
          returned_quantity?: number;
          sku?: string | null;
          updated_at?: string;
          workspace_id?: string;
          wrong_quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      return_timeline: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          created_at: string;
          event: string;
          id: string;
          message: string | null;
          metadata: Json;
          return_id: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          created_at?: string;
          event: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          return_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          created_at?: string;
          event?: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          return_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "return_timeline_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_timeline_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      returns: {
        Row: {
          assigned_to: string | null;
          assigned_to_name: string | null;
          completed_at: string | null;
          condition: string | null;
          courier: string | null;
          created_at: string;
          customer_name: string | null;
          id: string;
          inspection_date: string | null;
          inspection_notes: string | null;
          inspection_photos: Json;
          inspector_id: string | null;
          inspector_name: string | null;
          marketplace: string | null;
          order_id: string | null;
          order_number: string | null;
          packer_name: string | null;
          packing_date: string | null;
          packing_record_id: string | null;
          reason: string | null;
          received_at: string;
          resolution: string | null;
          return_number: string | null;
          rma: string;
          status: string;
          tracking_number: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          completed_at?: string | null;
          condition?: string | null;
          courier?: string | null;
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          inspection_date?: string | null;
          inspection_notes?: string | null;
          inspection_photos?: Json;
          inspector_id?: string | null;
          inspector_name?: string | null;
          marketplace?: string | null;
          order_id?: string | null;
          order_number?: string | null;
          packer_name?: string | null;
          packing_date?: string | null;
          packing_record_id?: string | null;
          reason?: string | null;
          received_at?: string;
          resolution?: string | null;
          return_number?: string | null;
          rma: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assigned_to?: string | null;
          assigned_to_name?: string | null;
          completed_at?: string | null;
          condition?: string | null;
          courier?: string | null;
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          inspection_date?: string | null;
          inspection_notes?: string | null;
          inspection_photos?: Json;
          inspector_id?: string | null;
          inspector_name?: string | null;
          marketplace?: string | null;
          order_id?: string | null;
          order_number?: string | null;
          packer_name?: string | null;
          packing_date?: string | null;
          packing_record_id?: string | null;
          reason?: string | null;
          received_at?: string;
          resolution?: string | null;
          return_number?: string | null;
          rma?: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_packing_record_id_fkey";
            columns: ["packing_record_id"];
            isOneToOne: false;
            referencedRelation: "packing_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_reports: {
        Row: {
          config: Json;
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          format: string;
          frequency: string;
          id: string;
          last_run_at: string | null;
          name: string;
          next_run_at: string | null;
          recipients: Json;
          report_type: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          format?: string;
          frequency: string;
          id?: string;
          last_run_at?: string | null;
          name: string;
          next_run_at?: string | null;
          recipients?: Json;
          report_type: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          format?: string;
          frequency?: string;
          id?: string;
          last_run_at?: string | null;
          name?: string;
          next_run_at?: string | null;
          recipients?: Json;
          report_type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          connection_status: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_sync_at: string | null;
          logo_url: string | null;
          marketplace: string;
          name: string;
          store_status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          connection_status?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_sync_at?: string | null;
          logo_url?: string | null;
          marketplace: string;
          name: string;
          store_status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          connection_status?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_sync_at?: string | null;
          logo_url?: string | null;
          marketplace?: string;
          name?: string;
          store_status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stores_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_runs: {
        Row: {
          connection_id: string;
          connector_key: string;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          metadata: Json;
          orders_failed: number;
          orders_imported: number;
          orders_updated: number;
          started_at: string;
          status: string;
          tracking_updated: number;
          trigger: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          connection_id: string;
          connector_key: string;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          metadata?: Json;
          orders_failed?: number;
          orders_imported?: number;
          orders_updated?: number;
          started_at?: string;
          status?: string;
          tracking_updated?: number;
          trigger?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          connection_id?: string;
          connector_key?: string;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          metadata?: Json;
          orders_failed?: number;
          orders_imported?: number;
          orders_updated?: number;
          started_at?: string;
          status?: string;
          tracking_updated?: number;
          trigger?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connector_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          account_expires_at: string | null;
          full_name: string | null;
          id: string;
          invited_by: string | null;
          joined_at: string;
          last_active_at: string | null;
          phone: string | null;
          status: Database["public"]["Enums"]["member_status"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          account_expires_at?: string | null;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          last_active_at?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["member_status"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          account_expires_at?: string | null;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string;
          last_active_at?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["member_status"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          address: string | null;
          created_at: string;
          currency: string;
          id: string;
          language: string;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          plan: string;
          preferences: Json;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          language?: string;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          plan?: string;
          preferences?: Json;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          language?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          plan?: string;
          preferences?: Json;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      touch_last_login: { Args: never; Returns: undefined };
    };
    Enums: {
      app_role: "Owner" | "Supervisor" | "Packer" | "Return Staff";
      invitation_status: "pending" | "accepted" | "revoked" | "expired";
      member_status: "active" | "invited" | "suspended";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["Owner", "Supervisor", "Packer", "Return Staff"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      member_status: ["active", "invited", "suspended"],
    },
  },
} as const;
