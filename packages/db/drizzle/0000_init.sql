CREATE TABLE "analytics_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"window_days" integer NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"duration_sec" double precision,
	"size_bytes" integer,
	"provider" text NOT NULL,
	"model" text,
	"prompt" text,
	"prompt_hash" text,
	"topic_id" text,
	"scene_id" text,
	"video_id" text,
	"rights" jsonb NOT NULL,
	"used_in_video_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capacity_windows" (
	"key" text PRIMARY KEY NOT NULL,
	"max_per_window" integer NOT NULL,
	"window_seconds" integer NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"window_start" double precision NOT NULL,
	"blocked_until" double precision
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"external_channel_id" text,
	"credentials_ref" text,
	"default_privacy" text DEFAULT 'private' NOT NULL,
	"default_publish_hour_local" integer DEFAULT 17 NOT NULL,
	"timezone" text DEFAULT 'Europe/Berlin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"video_id" text,
	"stage" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"capability" text NOT NULL,
	"units" double precision NOT NULL,
	"unit_type" text NOT NULL,
	"cost_usd" double precision NOT NULL,
	"cost_eur" double precision NOT NULL,
	"covered_by_quota" boolean DEFAULT false NOT NULL,
	"failed" boolean DEFAULT false NOT NULL,
	"retry" boolean DEFAULT false NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"niche" text NOT NULL,
	"language" text DEFAULT 'de' NOT NULL,
	"review_mode" text DEFAULT 'SAFE' NOT NULL,
	"max_videos_per_day" integer DEFAULT 1 NOT NULL,
	"auto_approve_threshold" double precision DEFAULT 0.85 NOT NULL,
	"min_publish_score" double precision DEFAULT 0.65 NOT NULL,
	"style_guide" jsonb NOT NULL,
	"rules_version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "qa_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"checks" jsonb NOT NULL,
	"score" jsonb NOT NULL,
	"decision" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"summary" text NOT NULL,
	"key_facts" jsonb NOT NULL,
	"claims" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"reviewer" text NOT NULL,
	"decision" text NOT NULL,
	"target_stage" text,
	"notes" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"format" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"hook_type" text NOT NULL,
	"sections" jsonb NOT NULL,
	"full_narration" text NOT NULL,
	"estimated_seconds" double precision NOT NULL,
	"word_count" integer NOT NULL,
	"model" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"ref" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storyboards" (
	"id" text PRIMARY KEY NOT NULL,
	"script_id" text NOT NULL,
	"aspect" text NOT NULL,
	"scenes" jsonb NOT NULL,
	"visual_style" text NOT NULL,
	"color_palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"format" text NOT NULL,
	"language" text DEFAULT 'de' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"factors" jsonb,
	"score" double precision,
	"status" text DEFAULT 'NEW' NOT NULL,
	"originality_check" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"channel_id" text,
	"topic_id" text NOT NULL,
	"format" text NOT NULL,
	"language" text NOT NULL,
	"stage" text DEFAULT 'IDEA' NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"stage_attempt" integer DEFAULT 0 NOT NULL,
	"research_id" text,
	"script_id" text,
	"storyboard_id" text,
	"render_asset_id" text,
	"thumbnail_asset_id" text,
	"qa_report_id" text,
	"metadata" jsonb,
	"experiment" jsonb,
	"quality_score" double precision,
	"cost_eur" double precision DEFAULT 0 NOT NULL,
	"status_reason" text,
	"resume_after" timestamp with time zone,
	"external_video_id" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"parent_video_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_reports" ADD CONSTRAINT "qa_reports_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_docs" ADD CONSTRAINT "research_docs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboards" ADD CONSTRAINT "storyboards_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_unique_idx" ON "analytics_snapshots" USING btree ("video_id","captured_at","window_days");--> statement-breakpoint
CREATE INDEX "assets_project_kind_idx" ON "assets" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "assets_video_idx" ON "assets" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "assets_prompt_hash_idx" ON "assets" USING btree ("prompt_hash");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "channels_project_idx" ON "channels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "costs_created_idx" ON "cost_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "costs_video_idx" ON "cost_entries" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "costs_project_created_idx" ON "cost_entries" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "qa_video_idx" ON "qa_reports" USING btree ("video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_project_version_idx" ON "rule_versions" USING btree ("project_id","version");--> statement-breakpoint
CREATE INDEX "scripts_topic_idx" ON "scripts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topics_project_status_idx" ON "topics" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "videos_project_stage_idx" ON "videos" USING btree ("project_id","stage","status");--> statement-breakpoint
CREATE INDEX "videos_created_idx" ON "videos" USING btree ("created_at");