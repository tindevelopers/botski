/**
 * Health check endpoint for Railway serverless
 * Returns 200 OK without requiring database or authentication
 * This allows Railway to verify the service is alive before routing traffic
 */
export default async (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'recall-meeting-assistant'
  });
};
