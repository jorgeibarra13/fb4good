const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const rateLimit = require("express-rate-limit");

const app = express();
const port = 3000;
// Initialize Firebase Admin with service account and database URL
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://feel-59c37-default-rtdb.firebaseio.com"
});

const db = admin.database();

// Automatically parse request body as JSON
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

const rateLimitOptions = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  message: "You can only make this update once every 24 hours."
};

// Rate limiters for each group of actions
const getLimiter = rateLimit({
  ...rateLimitOptions,
  max: 200
});

// Rate limiters for each group of actions
const worthItRateLimiter = rateLimit({
  ...rateLimitOptions,
  max: 3 // For example, max 20 requests per IP per day
});

const keepWorkingRateLimiter = rateLimit({
  ...rateLimitOptions,
  max: 3
});

const workSettingRateLimiter = rateLimit({
  ...rateLimitOptions,
  max: 3
});

const generalRatingRateLimiter = rateLimit({
  ...rateLimitOptions,
  max: 3
});

const weeklyHoursRateLimiter = rateLimit({
  ...rateLimitOptions,
  max: 3
});

// Apply the rate limiters to the endpoints
app.put('/company/:name/worthIt', worthItRateLimiter, updateWorthItHandler);
app.put('/company/:name/notWorthIt', worthItRateLimiter, updateNotWorthItHandler);
app.put('/company/:name/keepWorking', keepWorkingRateLimiter, updateKeepWorkingHandler);
app.put('/company/:name/notKeepWorking', keepWorkingRateLimiter, updateNotKeepWorkingHandler);
app.put('/company/:name/workSetting/:setting', workSettingRateLimiter, updateWorkSettingHandler);
app.put('/company/:name/generalRating', generalRatingRateLimiter, updateGeneralRatingHandler);
app.put('/company/:name/weeklyHours', weeklyHoursRateLimiter, updateWeeklyHoursHandler);


// PUT endpoint to update a company
function updateGeneralRatingHandler(req, res) {
  const { name } = req.params; // Get the company ID from the URL parameter
  const { rating } = req.body; // Expect a single rating value in the request body

  if (typeof rating !== 'number') {
    return res.status(400).json({ error: 'Rating must be a number' });
  }

  // You might want to validate the updated data as well

  const companyRef = db.ref(`company/${name}`);
  
  companyRef.transaction((company) => {
    if (company) {
      const newCount = (company.generalRatingCount || 0) + 1;
      const newRating = (company.generalRating || 0) * (company.generalRatingCount || 0) + rating;
      company.generalRating = newRating / newCount;
      company.generalRatingCount = newCount;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateWorthItHandler(req, res) {
  const { name } = req.params;

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      company.worthItCount = (company.worthItCount || 0) + 1;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateNotWorthItHandler(req, res) {
  const { name } = req.params;

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      company.notWorthItCount = (company.notWorthItCount || 0) + 1;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateKeepWorkingHandler(req, res) {
  const { name } = req.params;

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      company.keepWorkingCount = (company.keepWorkingCount || 0) + 1;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateNotKeepWorkingHandler(req, res) {
  const { name } = req.params;

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      company.notKeepWorkingCount = (company.notKeepWorkingCount || 0) + 1;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateWorkSettingHandler(req, res) {
  const { name, setting } = req.params;

  if (!['inOffice', 'hybrid', 'remote'].includes(setting)) {
    return res.status(400).json({ error: 'Invalid work setting' });
  }

  const field = `${setting}Count`; // e.g., 'hybridCount'

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      company[field] = (company[field] || 0) + 1;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}
function updateWeeklyHoursHandler(req, res) {
  const { name } = req.params;
  const { hours } = req.body; // Expect hours in the request body

  if (typeof hours !== 'number') {
    return res.status(400).json({ error: 'Weekly hours must be a number' });
  }

  const companyRef = db.ref(`company/${name}`);
  companyRef.transaction((company) => {
    if (company) {
      const newCount = (company.weeklyHoursRatingCount || 0) + 1;
      const newHours = (company.weeklyHours || 0) * (company.weeklyHoursRatingCount || 0) + hours;
      company.weeklyHours = newHours / newCount;
      company.weeklyHoursRatingCount = newCount;
      company.lastUpdated = admin.database.ServerValue.TIMESTAMP;
    }
    return company;
  }, handleTransactionResponse(res));
}

// Common transaction response handler
function handleTransactionResponse(res) {
  return (error, committed, snapshot) => {
    if (error) {
      res.status(500).json({ error: 'Transaction failed' });
    } else if (!committed) {
      res.status(400).json({ error: 'Transaction not committed' });
    } else {
      res.status(200).json(snapshot.val());
    }
  };
}

// GET endpoint to retrieve all companies
app.get('/company', getLimiter, (req, res) => {
  const companyRef = db.ref('company');
  companyRef.once('value', (snapshot) => {
    res.status(200).json(snapshot.val());
  }, (error) => {
    res.status(500).json({ error: 'Failed to retrieve data' });
  });
});

// GET endpoint to retrieve individual company
app.get('/company/:id', getLimiter, (req, res) => {
  const { id } = req.params; // Correctly defining 'id' from URL parameters
  const companyRef = db.ref(`company/${id}`);

  companyRef.once('value', (snapshot) => {
    res.status(200).json(snapshot.val());
  }, (error) => {
    res.status(500).json({ error: 'Failed to retrieve data' });
  });
});

// GET endpoint to retrieve all companies sorted by lastUpdated
app.get('/companies/sorted', getLimiter, (req, res) => {
  const companyRef = db.ref('company');
  
  // Query the companies, ordered by the 'lastUpdated' field
  companyRef.orderByChild('lastUpdated').once('value', (snapshot) => {
    // Since we want to sort in descending order and Firebase only sorts in ascending order,
    // we will retrieve the data and then reverse it on the server side
    const companiesArray = [];
    snapshot.forEach(childSnapshot => {
      // Add company data to the array
      companiesArray.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    // Reverse the array to get the newest items first
    companiesArray.reverse();

    res.status(200).json(companiesArray);
  }, (error) => {
    res.status(500).json({ error: 'Failed to retrieve data' });
  });
});

// Catch-all for 404 Not Found responses
app.use((req, res, next) => {
  res.status(404).send('Not Found');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
