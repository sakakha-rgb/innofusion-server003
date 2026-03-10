export default function handler(req, res) {
  res.status(200).json({ 
    status: "iNNO FUSION API",
    version: "1.0.0",
    endpoints: [
      "POST /api/generate",
      "POST /api/activate", 
      "POST /api/validate"
    ],
    timestamp: new Date().toISOString()
  });
}
