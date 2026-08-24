// Server application
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;
const stripeKey = process.env.STRIPE_PUBLIC_KEY; // Missing in .env and .env.example!

// Type Trap: ENABLE_BETA_FEATURES is "false", but in JS this condition is TRUE!
if (process.env.ENABLE_BETA_FEATURES) {
  console.log('Beta features active!');
}

export function startServer() {
  console.log(`Server listening on ${port}`);
}
