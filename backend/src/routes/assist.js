const express = require('express');
const router = express.Router();

/**
 * POST /api/assist/analyze
 * Analyzes a diagram description and returns architectural suggestions.
 * Uses OpenAI if API key is present, otherwise returns mock suggestions.
 */
router.post('/analyze', async (req, res) => {
  const { diagramDescription, objects } = req.body;

  if (!diagramDescription && (!objects || objects.length === 0)) {
    return res.status(400).json({ error: 'Provide a diagram description or objects' });
  }

  // Build a readable summary of canvas objects
  const objectSummary = objects
    ? objects
        .map((o) => `${o.type || 'shape'}: "${o.text || o.label || ''}"`)
        .join(', ')
    : '';

  const prompt = `
You are an expert software architect reviewing a system design diagram.
The diagram contains: ${diagramDescription || objectSummary}

Provide structured architectural suggestions in JSON format with these keys:
- apis: array of suggested APIs/services (name + reason)
- dbms: recommended database(s) with reasoning
- missing: components or patterns that are missing
- scalability: tips to improve scalability
- performance: performance optimization suggestions
- summary: one-paragraph overall feedback

Respond ONLY with valid JSON, no markdown.
`;

  try {
    // Use OpenAI if key exists
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const suggestions = JSON.parse(completion.choices[0].message.content);
      return res.json({ suggestions });
    }

    // Fallback: smart mock suggestions based on keywords
    const suggestions = generateMockSuggestions(diagramDescription || objectSummary);
    res.json({ suggestions, mock: true });
  } catch (err) {
    console.error('[Assist] Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze diagram' });
  }
});

function generateMockSuggestions(description) {
  const desc = description.toLowerCase();
  const isAuth = desc.includes('auth') || desc.includes('login') || desc.includes('user');
  const isPayment = desc.includes('payment') || desc.includes('stripe') || desc.includes('billing');
  const isStorage = desc.includes('storage') || desc.includes('upload') || desc.includes('file');

  return {
    apis: [
      { name: 'REST API Gateway', reason: 'Central entry point for all client requests with rate limiting' },
      isAuth ? { name: 'Auth0 / JWT', reason: 'Handles authentication & authorization securely' } : { name: 'GraphQL API', reason: 'Flexible data fetching for complex client requirements' },
      isPayment ? { name: 'Stripe API', reason: 'PCI-compliant payment processing' } : { name: 'SendGrid', reason: 'Transactional email delivery' },
      isStorage ? { name: 'AWS S3', reason: 'Scalable object storage for files and media' } : { name: 'Cloudflare CDN', reason: 'Edge caching for static assets' },
    ],
    dbms: isPayment
      ? 'PostgreSQL for transactional data integrity + Redis for session/cache'
      : 'MongoDB for flexible document storage + Redis for caching hot data',
    missing: [
      'Load balancer / reverse proxy (e.g., Nginx)',
      'Message queue for async tasks (e.g., BullMQ, RabbitMQ)',
      'Centralized logging (e.g., ELK Stack or Datadog)',
      'CI/CD pipeline in the architecture',
      !isAuth ? 'Authentication & authorization layer' : 'Multi-factor authentication (MFA)',
    ],
    scalability: [
      'Introduce horizontal scaling with container orchestration (Kubernetes)',
      'Add a CDN layer to serve static assets from the edge',
      'Use read replicas for your primary database to distribute read load',
      'Implement circuit breakers between microservices to prevent cascade failures',
    ],
    performance: [
      'Add Redis caching for frequently accessed data (target <10ms response)',
      'Use database indexing on all foreign keys and search fields',
      'Implement pagination and cursor-based navigation for large datasets',
      'Consider WebSockets or SSE for real-time features instead of polling',
    ],
    summary: `Your architecture shows a solid foundation. The main areas to address are: adding a proper load balancing layer, introducing asynchronous task processing via a message queue, and ensuring observability through logging and monitoring. With these additions, the system will be production-ready and horizontally scalable.`,
  };
}

module.exports = router;
