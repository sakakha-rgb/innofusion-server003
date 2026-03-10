// GET / - API Status
export default function handler(req, res) {
  res.status(200).json({ 
    status: "iNNO FUSION API",
    version: "1.0.0",
    endpoints: [
      "POST /api/activate - Activate license",
      "POST /api/validate - Validate license",
      "POST /api/generate - Generate license (Admin)"
    ],
    timestamp: new Date().toISOString()
  });
}