import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonSchema7ObjectType } from "zod-to-json-schema"; // Import type

// --- Constants ---
const CLICKHOUSE_API_BASE_URL = "https://api.clickhouse.cloud";

// --- Helper Function for API Calls ---

async function callClickHouseApi<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  apiKeyId: string,
  apiKeySecret: string,
  body?: unknown, // Body can be any JSON-serializable data
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const url = `${CLICKHOUSE_API_BASE_URL}${path}`;
  const authToken = btoa(`${apiKeyId}:${apiKeySecret}`); // Basic Auth

  const headers: HeadersInit = {
    Authorization: `Basic ${authToken}`,
    Accept: "application/json", // Default, override if needed
    ...additionalHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PATCH")) {
    options.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  // console.debug(`Calling ClickHouse API: ${method} ${url}`); // Optional debug logging

  const response = await fetch(url, options);

  // Handle Prometheus plain text responses
  if (response.headers.get("content-type")?.startsWith("text/plain")) {
    if (!response.ok) {
      // Attempt to read plain text error, otherwise use status text
       const errorText = await response.text().catch(() => response.statusText);
       throw new Error(
         `ClickHouse API Error (${method} ${path}): ${response.status} ${errorText}`,
       );
    }
     const textData = await response.text();
     // We need to return an object, so wrap the text
     return { plainTextResponse: textData } as T;
  }


  // Handle JSON responses (default)
  let responseData: any;
  try {
    // Handle cases with no content (e.g., successful DELETE)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
       responseData = { status: response.status, message: "Operation successful (No Content)" };
    } else {
       responseData = await response.json();
    }
  } catch (e) {
     // Handle cases where response is not JSON even if headers suggest it might be
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(
          `ClickHouse API Error (${method} ${path}): Failed to parse JSON response. Status: ${response.status}. Response text: ${errorText}`,
      );
  }


  if (!response.ok) {
    const errorMessage = responseData?.error || responseData?.message || JSON.stringify(responseData) || response.statusText;
    console.error(`ClickHouse API Error Response (${method} ${path}):`, responseData); // Log the full error
    throw new Error(
      `ClickHouse API Error (${method} ${path}): ${response.status} ${errorMessage}`,
    );
  }

  return responseData as T;
}

// --- Zod Schemas for Tool Inputs (Derived from OpenAPI Spec) ---

// Base schema for organization ID path parameter
const OrgIdParamSchema = z.object({
  organizationId: z.string().uuid().describe("ID of the organization."),
});

// Base schema for service ID path parameter (used with OrgId)
const ServiceIdParamSchema = OrgIdParamSchema.extend({
  serviceId: z.string().uuid().describe("ID of the service."),
});

// GET /v1/organizations
const ListOrganizationsSchema = z.object({}); // No parameters

// GET /v1/organizations/{organizationId}
const GetOrganizationDetailsSchema = OrgIdParamSchema;

// GET /v1/organizations/{organizationId}/services
const ListServicesSchema = OrgIdParamSchema;

// GET /v1/organizations/{organizationId}/services/{serviceId}
const GetServiceDetailsSchema = ServiceIdParamSchema;

// POST /v1/organizations/{organizationId}/services
// (Simplified version of ServicePostRequest from OpenAPI for brevity)
const IpAccessListEntrySchema = z.object({
  source: z.string().describe("IP or CIDR"),
  description: z.string().optional().describe("Optional description"),
});

const ServicePostRequestSchema = z.object({
  name: z.string().describe("Name of the service (alphanumerical, max 50 chars)."),
  provider: z.enum(["aws", "gcp", "azure"]).describe("Cloud provider."),
  region: z.enum([
      "ap-south-1", "ap-southeast-1", "eu-central-1", "eu-west-1", "eu-west-2",
      "us-east-1", "us-east-2", "us-west-2", "ap-southeast-2", "ap-northeast-1",
      "me-central-1", "us-east1", "us-central1", "europe-west4", "asia-southeast1",
      "eastus", "eastus2", "westus3", "germanywestcentral"
    ]).describe("Service region."),
  minReplicaMemoryGb: z.number().min(8).multipleOf(4).optional().describe("Min memory/replica (GB, multiple of 4, >=8)."),
  maxReplicaMemoryGb: z.number().min(8).multipleOf(4).optional().describe("Max memory/replica (GB, multiple of 4, >=8)."),
  numReplicas: z.number().min(1).max(20).optional().describe("Number of replicas (1-20). Defaults vary by tier."),
  ipAccessList: z.array(IpAccessListEntrySchema).optional().describe("List of allowed IP addresses."),
  // Add other fields from ServicePostRequest as needed (e.g., tier, idleScaling, dataWarehouseId...)
  // This is kept simple for the example.
});

const CreateServiceSchema = OrgIdParamSchema.extend({
   body: ServicePostRequestSchema.describe("Service creation details."),
});

// DELETE /v1/organizations/{organizationId}/services/{serviceId}
const DeleteServiceSchema = ServiceIdParamSchema;

// GET /v1/organizations/{organizationId}/keys
const ListApiKeysSchema = OrgIdParamSchema;

// PATCH /v1/organizations/{organizationId}/services/{serviceId}/state
const ServiceStatePatchRequestSchema = z.object({
    command: z.enum(["start", "stop"]).describe("Command to change the service state."),
});
const UpdateServiceStateSchema = ServiceIdParamSchema.extend({
   body: ServiceStatePatchRequestSchema.describe("Service state change command."),
});


// --- Tool Definitions ---

const CLICKHOUSE_TOOLS: Tool[] = [
  {
    name: "clickhouse_listOrganizations",
    description: "Get the list of organizations associated with the API key.",
    inputSchema: zodToJsonSchema(ListOrganizationsSchema) as JsonSchema7ObjectType,
  },
  {
    name: "clickhouse_getOrganizationDetails",
    description: "Get details for a specific organization.",
    inputSchema: zodToJsonSchema(GetOrganizationDetailsSchema) as JsonSchema7ObjectType,
  },
  {
    name: "clickhouse_listServices",
    description: "List services within a specific organization.",
    inputSchema: zodToJsonSchema(ListServicesSchema) as JsonSchema7ObjectType,
  },
  {
     name: "clickhouse_getServiceDetails",
     description: "Get details for a specific service within an organization.",
     inputSchema: zodToJsonSchema(GetServiceDetailsSchema) as JsonSchema7ObjectType,
  },
  {
     name: "clickhouse_createService",
     description: "Create a new service within an organization.",
     inputSchema: zodToJsonSchema(CreateServiceSchema) as JsonSchema7ObjectType,
  },
  {
     name: "clickhouse_deleteService",
     description: "Delete a specific service within an organization. The service must be stopped first.",
     inputSchema: zodToJsonSchema(DeleteServiceSchema) as JsonSchema7ObjectType,
  },
   {
      name: "clickhouse_listApiKeys",
      description: "List API keys for a specific organization.",
      inputSchema: zodToJsonSchema(ListApiKeysSchema) as JsonSchema7ObjectType,
   },
   {
      name: "clickhouse_updateServiceState",
      description: "Start or stop a specific service.",
      inputSchema: zodToJsonSchema(UpdateServiceStateSchema) as JsonSchema7ObjectType,
   },
  // Add more tools here based on the OpenAPI spec...
  // Example:
  // {
  //   name: "clickhouse_getServicePrometheusMetrics",
  //   description: "Get prometheus metrics for a specific service.",
  //   inputSchema: zodToJsonSchema(ServiceIdParamSchema.extend({
  //       filtered_metrics: z.boolean().optional().describe("Return a filtered list of Prometheus metrics.")
  //   })) as JsonSchema7ObjectType,
  // }
];

// --- Server Creation ---

export const createServer = () => {
  const server = new Server(
    {
      name: "mcp-server-clickhouse",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {}, // Enable tools capability
        // Add other capabilities like logging if needed
      },
    },
  );

  // --- Request Handlers ---

  server.setRequestHandler(ListToolsRequestSchema, async (_request) => {
    return { tools: CLICKHOUSE_TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // --- Get API Credentials ---
    const apiKeyId = process.env.CLICKHOUSE_API_KEY_ID;
    const apiKeySecret = process.env.CLICKHOUSE_API_SECRET;

    if (!apiKeyId || !apiKeySecret) {
      throw new Error(
        "ClickHouse API Key ID or Secret not configured. Set CLICKHOUSE_API_KEY_ID and CLICKHOUSE_API_SECRET environment variables.",
      );
    }

    let result: unknown;

    try {
        // --- Tool Implementations ---
        switch (name) {
          case "clickhouse_listOrganizations":
            ListOrganizationsSchema.parse(args); // Validate empty args
            result = await callClickHouseApi(
              "/v1/organizations",
              "GET",
              apiKeyId,
              apiKeySecret,
            );
            break;

          case "clickhouse_getOrganizationDetails": {
            const validatedArgs = GetOrganizationDetailsSchema.parse(args);
            result = await callClickHouseApi(
              `/v1/organizations/${validatedArgs.organizationId}`,
              "GET",
              apiKeyId,
              apiKeySecret,
            );
            break;
          }

          case "clickhouse_listServices": {
            const validatedArgs = ListServicesSchema.parse(args);
            result = await callClickHouseApi(
              `/v1/organizations/${validatedArgs.organizationId}/services`,
              "GET",
              apiKeyId,
              apiKeySecret,
            );
            break;
          }

          case "clickhouse_getServiceDetails": {
            const validatedArgs = GetServiceDetailsSchema.parse(args);
            result = await callClickHouseApi(
              `/v1/organizations/${validatedArgs.organizationId}/services/${validatedArgs.serviceId}`,
              "GET",
              apiKeyId,
              apiKeySecret,
            );
            break;
          }

          case "clickhouse_createService": {
             const validatedArgs = CreateServiceSchema.parse(args);
             result = await callClickHouseApi(
               `/v1/organizations/${validatedArgs.organizationId}/services`,
               "POST",
               apiKeyId,
               apiKeySecret,
               validatedArgs.body, // Pass the nested body object
             );
             break;
          }

          case "clickhouse_deleteService": {
            const validatedArgs = DeleteServiceSchema.parse(args);
            // DELETE often returns 200 or 204 with no body, callClickHouseApi handles 204
             result = await callClickHouseApi(
               `/v1/organizations/${validatedArgs.organizationId}/services/${validatedArgs.serviceId}`,
               "DELETE",
               apiKeyId,
               apiKeySecret,
             );
             break;
          }

          case "clickhouse_listApiKeys": {
             const validatedArgs = ListApiKeysSchema.parse(args);
             result = await callClickHouseApi(
               `/v1/organizations/${validatedArgs.organizationId}/keys`,
               "GET",
               apiKeyId,
               apiKeySecret,
             );
             break;
          }

          case "clickhouse_updateServiceState": {
             const validatedArgs = UpdateServiceStateSchema.parse(args);
             result = await callClickHouseApi(
               `/v1/organizations/${validatedArgs.organizationId}/services/${validatedArgs.serviceId}/state`,
               "PATCH",
               apiKeyId,
               apiKeySecret,
               validatedArgs.body, // Pass the nested body object
             );
             break;
          }

          // --- Add cases for other tools here ---
          // case "clickhouse_getServicePrometheusMetrics": {
          //   const validatedArgs = ServiceIdParamSchema.extend({
          //       filtered_metrics: z.boolean().optional()
          //   }).parse(args);
          //   const queryParams = validatedArgs.filtered_metrics ? `?filtered_metrics=${validatedArgs.filtered_metrics}` : '';
          //   result = await callClickHouseApi(
          //     `/v1/organizations/${validatedArgs.organizationId}/services/${validatedArgs.serviceId}/prometheus${queryParams}`,
          //     "GET",
          //     apiKeyId,
          //     apiKeySecret,
          //     undefined,
          //     { Accept: 'text/plain' } // Override Accept header
          //   );
          //   // Result will be { plainTextResponse: "..." }
          //   break;
          // }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        console.error(`Error calling tool ${name}:`, error);
        // Re-throw the specific error message from the API call or validation
        throw new Error(`Tool ${name} failed: ${error.message}`);
    }


    // Format the result as MCP content
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  // --- Cleanup ---
  const cleanup = async () => {
    // Add any cleanup logic here (e.g., closing connections)
    console.log("ClickHouse MCP Server cleaning up...");
  };

  return { server, cleanup };
};