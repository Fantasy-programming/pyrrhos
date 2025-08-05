/**
 * AWS Lambda deployment example
 * 
 * This shows how to deploy OpenAnalytics to AWS Lambda
 * using DynamoDB for storage.
 */

import { openanalytics, DynamoDBStorage } from "../src";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

// Create analytics instance with DynamoDB
const analytics = openanalytics({
  storage: DynamoDBStorage({
    tableName: process.env.DYNAMODB_TABLE_NAME || "analytics-events",
    region: process.env.AWS_REGION || "us-east-1",
    // AWS credentials will be automatically picked up from IAM role
  }),
  
  writeKeys: [process.env.WRITE_KEY || ""],
  
  dashboard: {
    enabled: true,
    path: "/dashboard",
    apiKey: process.env.DASHBOARD_KEY,
    title: "AWS Lambda Analytics",
  },
  
  // Custom event processing
  processEvents: async (events) => {
    // Example: Add AWS-specific metadata
    return events.map(event => ({
      ...event,
      properties: {
        ...event.properties,
        deployment: "aws-lambda",
        region: process.env.AWS_REGION,
      },
    }));
  },
});

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Convert API Gateway event to standard Request
    const request = new Request(
      `https://${event.headers.Host}${event.path}${event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''}`,
      {
        method: event.httpMethod,
        headers: new Headers(event.headers as Record<string, string>),
        body: event.body,
      }
    );

    // Process with OpenAnalytics
    const response = await analytics.fetch(request);
    
    // Convert Response back to API Gateway format
    const responseBody = await response.text();
    
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    };
  } catch (error) {
    console.error("Lambda handler error:", error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

// Example CloudFormation template snippet for DynamoDB table:
/*
Resources:
  AnalyticsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: analytics-events
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: timestamp
          AttributeType: N
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: timestamp-index
          KeySchema:
            - AttributeName: timestamp
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
*/