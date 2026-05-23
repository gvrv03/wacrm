# Requirements Document

## Introduction

This feature enhances the existing Flows system in the WhatsApp CRM by adding two new node types (API Request and Wait/Schedule Message), a real-time workflow visualization layer, and full CRUD operations for workflow management. The existing flow builder uses React Flow (@xyflow/react) for the visual canvas, Supabase for persistence, and a node-graph engine that walks customers through conversation flows. These enhancements extend the system to support external integrations, time-delayed messaging, runtime status visibility, and streamlined workflow lifecycle management.

## Glossary

- **Flow_Engine**: The server-side runner (`src/lib/flows/engine.ts`) that advances a flow run through its node graph, executing each node and deciding the next step.
- **Flow_Builder**: The React Flow-based visual canvas editor (`src/components/flows/flow-builder.tsx`) where users design and configure flow node graphs.
- **Flow_Node**: A single step in a flow graph, stored in the `flow_nodes` table, identified by a stable `node_key` string.
- **Flow_Run**: An active execution instance of a flow for a specific contact, stored in the `flow_runs` table with status tracking.
- **API_Request_Node**: A new flow node type that makes HTTP requests to external URLs and routes the flow based on the response.
- **Wait_Node**: A new flow node type that pauses execution for a configured duration before sending a message and advancing.
- **Visualization_Layer**: A UI overlay on the flow builder canvas that displays real-time execution status of nodes during an active flow run.
- **Workflow_CRUD**: The set of create, read, update, and delete operations for managing workflow definitions.
- **Node_Status**: The runtime state of a node within an active flow run: active (currently executing), completed (successfully executed), failed (execution error), or pending (not yet reached).

## Requirements

### Requirement 1: API Request Node Configuration

**User Story:** As a flow designer, I want to configure an API Request node in the flow builder, so that I can define HTTP calls to external services as part of my conversation flows.

#### Acceptance Criteria

1. THE Flow_Builder SHALL display an "API Request" node type in the component sidebar under the "integration" category.
2. WHEN a user adds an API_Request_Node to the canvas, THE Flow_Builder SHALL present a configuration panel with fields for HTTP method, URL, headers, and request body.
3. THE Flow_Builder SHALL support selection of HTTP methods GET, POST, PUT, DELETE, and PATCH for the API_Request_Node, with GET as the default selection.
4. WHEN the HTTP method is GET or DELETE, THE Flow_Builder SHALL hide the request body field in the configuration panel.
5. THE Flow_Builder SHALL allow the user to add between zero and 20 custom headers as key-value pairs on the API_Request_Node, where each header name is at most 256 characters and each header value is at most 2048 characters.
6. THE Flow_Builder SHALL allow the user to define the request body as a JSON text field for POST, PUT, and PATCH methods, accepting input up to 32,000 characters in length.
7. THE Flow_Builder SHALL support `{{vars.X}}` interpolation syntax in the URL, headers, and body fields of the API_Request_Node, where X matches the pattern `[a-zA-Z0-9_]+`.
8. THE Flow_Builder SHALL accept a URL of up to 2048 characters for the API_Request_Node and SHALL require the URL to begin with `https://`.
9. IF the user attempts to save an API_Request_Node with an empty URL field, THEN THE Flow_Builder SHALL display a validation error indicating that the URL is required and SHALL prevent saving the node configuration.
10. IF the user enters text in the request body field that is not valid JSON, THEN THE Flow_Builder SHALL display a validation warning indicating the body is not valid JSON.

### Requirement 2: API Request Node Execution

**User Story:** As a flow designer, I want the API Request node to execute HTTP calls at runtime and route the flow based on the response, so that my flows can integrate with external systems.

#### Acceptance Criteria

1. WHEN the Flow_Engine reaches an API_Request_Node during a flow run, THE Flow_Engine SHALL make an HTTP request to the configured URL using the specified method (GET, POST, PUT, PATCH, or DELETE), headers, and body.
2. WHEN the HTTP response status code is in the 2xx range, THE Flow_Engine SHALL advance the flow run to the node configured in the `success_next` field.
3. WHEN the HTTP response status code is outside the 2xx range, THE Flow_Engine SHALL log the status code in `flow_run_events` and advance the flow run to the node configured in the `failure_next` field.
4. IF the HTTP request does not receive a complete response within 30 seconds, THEN THE Flow_Engine SHALL treat the request as failed and advance to the `failure_next` node.
5. IF the HTTP request encounters a network error (DNS resolution failure, connection refused, or connection reset), THEN THE Flow_Engine SHALL log the error type and detail in `flow_run_events` and advance to the `failure_next` node.
6. WHEN the HTTP response content type is JSON, THE Flow_Engine SHALL parse the response body (up to 64 KB) and store the resulting object in `flow_runs.vars` under the configured `response_var_key`.
7. WHEN the HTTP response content type is plain text, THE Flow_Engine SHALL store the response text (up to 64 KB) in `flow_runs.vars` under the configured `response_var_key`.
8. IF the HTTP response content type is neither JSON nor plain text, THEN THE Flow_Engine SHALL store no value in `flow_runs.vars` and advance to the `success_next` or `failure_next` node based on the status code.
9. THE Flow_Engine SHALL interpolate `{{vars.X}}` placeholders in the URL, headers, and body before making the HTTP request, replacing any placeholder whose key does not exist in `flow_runs.vars` with an empty string.
10. IF the `failure_next` field is not configured and the request fails, THEN THE Flow_Engine SHALL log the error in `flow_run_events` and end the flow run with status `failed` and end_reason `api_request_no_failure_path`.

### Requirement 3: Wait/Schedule Message Node Configuration

**User Story:** As a flow designer, I want to configure a Wait/Schedule Message node in the flow builder, so that I can introduce time delays and send follow-up messages in my conversation flows.

#### Acceptance Criteria

1. THE Flow_Builder SHALL display a "Wait & Send" node type in the component sidebar under the "messaging" category.
2. WHEN a user adds a Wait_Node to the canvas, THE Flow_Builder SHALL present a configuration panel with fields for delay duration (numeric input), delay unit (dropdown), timing mode (radio or dropdown), and message content section.
3. THE Flow_Builder SHALL support delay units of minutes, hours, days, and weeks for the Wait_Node, selectable from a dropdown control.
4. THE Flow_Builder SHALL accept a delay duration as a positive integer between 1 and 672 (inclusive) for the Wait_Node, and SHALL disable the save action if the value is outside this range or non-numeric.
5. THE Flow_Builder SHALL support timing modes of "fixed" (delay counted from the moment the node is entered at runtime) and "relative" (delay counted from the timestamp of the last message sent in the flow) for the Wait_Node.
6. THE Flow_Builder SHALL allow the user to select a message type of text, image, video, audio, file, location, or interactive for the Wait_Node.
7. WHEN the message type is "text", THE Flow_Builder SHALL display a text input field for the message content that accepts between 1 and 4096 characters.
8. WHEN the message type is "image", "video", "audio", or "file", THE Flow_Builder SHALL display a media URL input field that accepts a valid URL of up to 2048 characters.
9. WHEN the message type is "location", THE Flow_Builder SHALL display latitude (decimal, range -90 to 90) and longitude (decimal, range -180 to 180) input fields.
10. WHEN the message type is "interactive", THE Flow_Builder SHALL display button configuration fields consistent with the existing send_buttons node.
11. IF the user attempts to save a Wait_Node with an empty message content (no text entered, no media URL provided, no coordinates filled, or no buttons configured depending on the selected message type), THEN THE Flow_Builder SHALL display a validation error indicating the required fields and SHALL prevent saving the node configuration.

### Requirement 4: Wait/Schedule Message Node Execution

**User Story:** As a flow designer, I want the Wait/Schedule Message node to pause execution for the configured duration and then send the message, so that I can create timed follow-up sequences.

#### Acceptance Criteria

1. WHEN the Flow_Engine reaches a Wait_Node during a flow run, THE Flow_Engine SHALL record the scheduled send time in the `scheduled_send_at` column of the `flow_runs` table, set the run status to "active", and suspend further node advancement until the scheduled time.
2. WHEN the timing mode is "fixed", THE Flow_Engine SHALL calculate the scheduled send time as the current timestamp plus the configured delay duration, where delay duration is the product of `delay_amount` (integer, 1 to 1440) and `delay_unit` (one of: minutes, hours, days, weeks).
3. WHEN the timing mode is "relative", THE Flow_Engine SHALL calculate the scheduled send time as the `last_advanced_at` timestamp of the flow run plus the configured delay duration, where delay duration is the product of `delay_amount` and `delay_unit`.
4. THE Flow_Engine SHALL use a cron job polling at most every 60 seconds to query for flow runs whose `scheduled_send_at` is non-null and in the past, and whose status is "active".
5. WHEN the cron job finds a flow run with a passed `scheduled_send_at`, THE Flow_Engine SHALL send the configured message to the contact via the WhatsApp API, applying `{{vars.X}}` interpolation to text content by replacing each token with the corresponding value from `flow_runs.vars` or an empty string if the key is absent.
6. WHEN the message is sent successfully, THE Flow_Engine SHALL clear the `scheduled_send_at` field and advance the flow run to the node configured in the `next_node_key` field.
7. IF the message send fails, THEN THE Flow_Engine SHALL log the error in `flow_run_events` with event_type "error" and retry up to 3 times with exponential backoff starting at a 30-second base interval (30s, 60s, 120s).
8. IF all 3 retry attempts fail, THEN THE Flow_Engine SHALL mark the flow run as failed with end_reason "wait_send_failed" and clear the `scheduled_send_at` field.
9. IF the flow run status changes to "timed_out", "failed", "handed_off", or "paused_by_agent" while a `scheduled_send_at` is pending, THEN THE Flow_Engine SHALL skip sending the scheduled message and clear the `scheduled_send_at` field.

### Requirement 5: Workflow Visualization

**User Story:** As a flow designer, I want to see the real-time execution status of nodes when a workflow is running, so that I can monitor and debug active flow runs.

#### Acceptance Criteria

1. WHEN a user views a flow that has at least one run with status "active", THE Visualization_Layer SHALL display a run selector listing up to 50 runs (ordered newest first) allowing the user to pick a specific flow run to visualize.
2. WHILE a flow run is selected for visualization, THE Visualization_Layer SHALL color the node matching the run's `current_node_key` in green on the canvas.
3. WHILE a flow run is selected for visualization, THE Visualization_Layer SHALL color nodes that have a `node_entered` event followed by a subsequent `node_entered` event for a different node (and no `error` event with a terminal `end_reason`) in blue on the canvas.
4. WHILE a flow run is selected for visualization, THE Visualization_Layer SHALL color nodes whose last associated event is of type `error` with a terminal `end_reason` (failed) in red on the canvas.
5. WHILE a flow run is selected for visualization, THE Visualization_Layer SHALL color nodes that have no `node_entered` event in the run's `flow_run_events` in yellow on the canvas.
6. WHILE a flow run is selected for visualization, THE Visualization_Layer SHALL poll for updated node statuses every 5 seconds.
7. WHEN a flow run reaches a terminal state (completed, handed_off, timed_out, paused_by_agent, or failed), THE Visualization_Layer SHALL stop polling and display the final status.
8. THE Visualization_Layer SHALL derive node statuses from the `flow_run_events` table entries and the `current_node_key` field on the `flow_runs` row for the selected flow run.
9. IF the polling request fails due to a network or server error, THEN THE Visualization_Layer SHALL retry up to 3 times with a 5-second delay between attempts before displaying an error indication to the user.

### Requirement 6: Workflow Create Operation

**User Story:** As a user, I want to create a new workflow from scratch or from a template, so that I can build new conversation flows.

#### Acceptance Criteria

1. WHEN the user clicks "New flow" on the flows list page, THE Workflow_CRUD SHALL open a creation dialog with options to start blank or from a template.
2. WHEN the user provides a name and clicks "Create blank flow", THE Workflow_CRUD SHALL create a new flow record with status "draft" and redirect to the flow editor.
3. WHEN the user selects a template, THE Workflow_CRUD SHALL clone the template nodes and configuration into a new draft flow with the template's default name and redirect to the flow editor.
4. IF the user submits a flow name that is empty or contains only whitespace characters, THEN THE Workflow_CRUD SHALL disable the "Create blank flow" action and not submit the creation request.
5. THE Workflow_CRUD SHALL enforce a maximum flow name length of 100 characters in the creation input.
6. IF the flow creation fails due to a server error or an invalid template selection, THEN THE Workflow_CRUD SHALL display an error toast notification indicating the nature of the failure and preserve the dialog state so the user can retry.
7. IF the user provides a template_slug that does not match any known template, THEN THE Workflow_CRUD SHALL reject the request and display an error toast notification indicating the template is not recognized.

### Requirement 7: Workflow Edit Operation

**User Story:** As a user, I want to edit an existing workflow's metadata and node configuration, so that I can refine my conversation flows over time.

#### Acceptance Criteria

1. WHEN the user clicks "Edit" on a flow card, THE Workflow_CRUD SHALL navigate to the flow editor page at `/flows/{flow_id}` for that flow.
2. IF the flow does not exist or the user does not own it, THEN THE Workflow_CRUD SHALL display a "Flow not found" message and a link to navigate back to the flows list.
3. THE Flow_Builder SHALL allow the user to modify the flow name (1 to 100 characters), description (0 to 500 characters), trigger type, and trigger configuration in the toolbar.
4. THE Flow_Builder SHALL allow the user to add, remove, reposition, and reconfigure nodes on the canvas.
5. WHEN the user modifies any flow metadata, node configuration, node position, or connection, THE Flow_Builder SHALL display a visual dirty-state indicator in the toolbar to signal unsaved changes.
6. WHEN the user clicks "Save Workflow", THE Flow_Builder SHALL persist all changes to the flow metadata and its nodes in a single PUT request to the API.
7. IF the save operation fails, THEN THE Flow_Builder SHALL display an error toast notification indicating the failure reason and retain all unsaved changes in the editor without navigating away.
8. WHEN the save operation succeeds, THE Flow_Builder SHALL clear the dirty-state indicator and display a success toast notification.

### Requirement 8: Workflow Delete Operation

**User Story:** As a user, I want to delete a workflow I no longer need, so that I can keep my flows list organized.

#### Acceptance Criteria

1. WHEN the user clicks "Delete" on a flow card, THE Workflow_CRUD SHALL display a confirmation dialog that includes the flow name and a warning that active runs will end immediately.
2. IF the user dismisses or cancels the confirmation dialog, THEN THE Workflow_CRUD SHALL take no action and leave the flow unchanged.
3. WHEN the user confirms deletion, THE Workflow_CRUD SHALL send a DELETE request to the API and, upon a successful response, remove the flow card from the list without requiring a page refresh.
4. WHEN a flow is deleted via the API, THE Flow_Engine SHALL terminate all active runs for that flow by removing the run records (via CASCADE) so that the contact is freed for new flow triggers within 1 second of the DELETE completing.
5. IF the DELETE request returns a non-success status, THEN THE Workflow_CRUD SHALL display an error toast notification indicating the flow could not be deleted and SHALL leave the flow card visible in the list.

### Requirement 9: API Request Node Database Schema

**User Story:** As a developer, I want the database schema to support the API Request node type, so that the node configuration can be persisted and validated.

#### Acceptance Criteria

1. THE database migration SHALL add "api_request" to the `flow_nodes_node_type_check` constraint on the `flow_nodes` table while preserving all existing allowed values (start, send_message, send_buttons, send_list, collect_input, condition, set_tag, handoff, end, send_chatbot_reply).
2. THE `flow_nodes.config` JSONB column SHALL store the API_Request_Node configuration with the following fields: `method` (required, one of "GET", "POST", "PUT", "DELETE", "PATCH"), `url` (required, string, maximum 2048 characters), `headers` (optional, object mapping header name strings to header value strings), `body` (optional, string containing JSON text, present only when method is POST, PUT, or PATCH), `response_var_key` (required, string identifying the key under which the response is stored in `flow_runs.vars`), `success_next` (required, string referencing a valid `node_key`), and `failure_next` (required, string referencing a valid `node_key`).
3. IF the `method` field value is "GET" or "DELETE", THEN THE database migration SHALL allow the `body` field to be absent or null in the stored config.

### Requirement 10: Wait/Schedule Message Node Database Schema

**User Story:** As a developer, I want the database schema to support the Wait/Schedule Message node type and its scheduling state, so that delayed messages can be tracked and executed.

#### Acceptance Criteria

1. THE database migration SHALL add "wait_send_message" to the `flow_nodes_node_type_check` constraint on the `flow_nodes` table.
2. THE `flow_nodes.config` JSONB column SHALL store the Wait_Node configuration including: `delay_amount` (integer, 1 to 1440), `delay_unit` (one of "minutes", "hours", "days", "weeks"), `timing_mode` (one of "fixed", "relative"), `message_type` (one of "text", "image", "video", "audio", "file", "location", "interactive"), `message_content` (object containing the message payload fields appropriate to the chosen message_type), and `next_node_key` (string referencing the subsequent node).
3. THE database migration SHALL add a nullable `scheduled_send_at` column of type TIMESTAMPTZ to the `flow_runs` table for tracking when a waiting node should fire.
4. THE database migration SHALL add a partial index on `flow_runs(scheduled_send_at)` filtered to `status = 'active'` AND `scheduled_send_at IS NOT NULL` for efficient cron polling.
5. WHEN a flow run enters a wait_send_message node, THE system SHALL compute `scheduled_send_at` from the node's `delay_amount` and `delay_unit` relative to the current timestamp (if `timing_mode` is "fixed") or from the `last_advanced_at` timestamp (if `timing_mode` is "relative"), and persist it on the `flow_runs` row.
