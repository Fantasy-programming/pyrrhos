import type { Storage, Event, QueryOptions, QueryResult } from "./index";
import { AwsClient } from "aws4fetch";

export interface DynamoDBStorageOptions {
  tableName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For local development
}

export function DynamoDBStorage(options: DynamoDBStorageOptions): Storage {
  const { tableName, region, accessKeyId, secretAccessKey, endpoint } = options;
  
  const aws = new AwsClient({
    accessKeyId: accessKeyId || process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY!,
    region,
  });

  const dynamoEndpoint = endpoint || `https://dynamodb.${region}.amazonaws.com`;

  const putItem = async (item: any) => {
    const response = await aws.fetch(`${dynamoEndpoint}/`, {
      method: "POST",
      headers: {
        "X-Amz-Target": "DynamoDB_20120810.PutItem",
        "Content-Type": "application/x-amz-json-1.0",
      },
      body: JSON.stringify({
        TableName: tableName,
        Item: item,
      }),
    });

    if (!response.ok) {
      throw new Error(`DynamoDB PutItem failed: ${response.status}`);
    }
  };

  const batchWriteItem = async (items: any[]) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += 25) { // DynamoDB batch limit is 25
      chunks.push(items.slice(i, i + 25));
    }

    await Promise.all(chunks.map(async chunk => {
      const response = await aws.fetch(`${dynamoEndpoint}/`, {
        method: "POST",
        headers: {
          "X-Amz-Target": "DynamoDB_20120810.BatchWriteItem",
          "Content-Type": "application/x-amz-json-1.0",
        },
        body: JSON.stringify({
          RequestItems: {
            [tableName]: chunk.map(item => ({
              PutRequest: { Item: item }
            }))
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`DynamoDB BatchWriteItem failed: ${response.status}`);
      }
    }));
  };

  const toDynamoDBItem = (event: Event) => {
    return {
      id: { S: event.id || crypto.randomUUID() },
      timestamp: { N: event.timestamp.toString() },
      type: { S: event.type },
      siteId: event.siteId ? { S: event.siteId } : { NULL: true },
      userId: event.userId ? { S: event.userId } : { NULL: true },
      sessionId: event.sessionId ? { S: event.sessionId } : { NULL: true },
      properties: { S: JSON.stringify(event.properties || {}) },
      ip: event.ip ? { S: event.ip } : { NULL: true },
      ua: event.ua ? { S: event.ua } : { NULL: true },
      referrer: event.referrer ? { S: event.referrer } : { NULL: true },
      url: event.url ? { S: event.url } : { NULL: true },
      language: event.language ? { S: event.language } : { NULL: true },
      screenWidth: event.screenWidth ? { N: event.screenWidth.toString() } : { NULL: true },
      screenHeight: event.screenHeight ? { N: event.screenHeight.toString() } : { NULL: true },
    };
  };

  const fromDynamoDBItem = (item: any): Event => {
    return {
      id: item.id?.S,
      timestamp: parseInt(item.timestamp?.N || '0'),
      type: item.type?.S || '',
      siteId: item.siteId?.S,
      userId: item.userId?.S,
      sessionId: item.sessionId?.S,
      properties: JSON.parse(item.properties?.S || '{}'),
      ip: item.ip?.S,
      ua: item.ua?.S,
      referrer: item.referrer?.S,
      url: item.url?.S,
      language: item.language?.S,
      screenWidth: item.screenWidth?.N ? parseInt(item.screenWidth.N) : undefined,
      screenHeight: item.screenHeight?.N ? parseInt(item.screenHeight.N) : undefined,
    };
  };

  return {
    async storeEvents(events: Event[]): Promise<void> {
      const items = events.map(toDynamoDBItem);
      
      if (items.length === 1) {
        await putItem(items[0]);
      } else {
        await batchWriteItem(items);
      }
    },

    async queryEvents(options: QueryOptions): Promise<QueryResult> {
      const { start, end = Date.now(), filter, limit = 1000 } = options;
      const startTime = start || 0;

      // Build filter expression for timestamp range
      let filterExpression = `#ts BETWEEN :start AND :end`;
      const expressionAttributeNames = { "#ts": "timestamp" };
      const expressionAttributeValues = {
        ":start": { N: startTime.toString() },
        ":end": { N: end.toString() }
      };

      const allItems: any[] = [];
      let lastEvaluatedKey;

      do {
        const result = await aws.fetch(`${dynamoEndpoint}/`, {
          method: "POST",
          headers: {
            "X-Amz-Target": "DynamoDB_20120810.Scan",
            "Content-Type": "application/x-amz-json-1.0",
          },
          body: JSON.stringify({
            TableName: tableName,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: Math.min(limit, 1000),
            ExclusiveStartKey: lastEvaluatedKey,
          }),
        });

        if (!result.ok) {
          throw new Error(`DynamoDB Scan failed: ${result.status}`);
        }

        const data = await result.json();
        allItems.push(...data.Items);
        lastEvaluatedKey = data.LastEvaluatedKey;
      } while (lastEvaluatedKey && allItems.length < limit);

      const events = allItems.map(fromDynamoDBItem);

      // Apply additional filtering if provided
      let filteredEvents = events;
      if (filter) {
        try {
          const filterFn = new Function('event', `return ${filter}`);
          filteredEvents = events.filter(filterFn);
        } catch (e) {
          console.error("Invalid filter expression:", e);
        }
      }

      // Sort by timestamp (most recent first)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      const resultEvents = filteredEvents.slice(0, limit);

      // Calculate metrics
      const uniqueUsers = new Set(resultEvents.map(e => e.userId || e.ip)).size;
      const pageViews = resultEvents.filter(e => e.type === 'pageview').length;

      return {
        events: resultEvents,
        metrics: {
          totalEvents: resultEvents.length,
          uniqueUsers,
          pageViews,
        },
      };
    }
  };
}