const express = require("express");
require("dotenv").config();
const { sequelize } = require("./src/models");
const routes = require("./src/routes");
const errorHandler = require("./src/middlewares/errorHandler");
const rateLimiter = require("./src/utils/rateLimiter");
const cors = require("cors");
const path = require("path");
require("./src/helpers/logger");
const app = express();
const apiLogger = require("./src/middlewares/logApiCalls");
const { createDefaultAdmin } = require("./src/helpers/adminSeeder");
const {initializeDefaultSettings} = require("./src/helpers/settingSeeder")
const { stripeWebhookHandler, paypalWebhookHandler } = require("./src/controllers/user/paymentController");
const { startLessonReminderCron ,startAutoBlockCron  } = require("./config/cron_job")

app.set("trust proxy", 1);
app.use(rateLimiter);

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://192.168.80.67:5173",
    "http://192.168.80.67:5174",
    "http://localhost:4000",
    "http://192.168.80.59:4000",
    "https://shakira-undeducible-lekisha.ngrok-free.dev",
    "https://unimmured-vernetta-tardier.ngrok-free.dev",
    "https://nonallelic-sara-imperatival.ngrok-free.dev",
    "http://192.168.80.176:5173",
    "http://192.168.80.59:5173",
    "http://192.168.80.176:5174",
    "https://shakira-undeducible-lekisha.ngrok-free.dev",
    "https://truewaydrivingschool.com.au",
    "https://admin.truewaydrivingschool.com.au",
    "http://192.168.80.77:5174",
    "http://192.168.80.77:5173",
    "http://192.168.80.78:5174",
    "http://192.168.80.78:5173"
  ],
  credentials: true,
};

// const corsOptions = {
//   origin: "*",
// };

// Testing CodeRabbit review

app.use(cors(corsOptions));
app.use(apiLogger);



app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);
app.post(
  "/paypal-webhook",
  express.raw({ type: "application/json" }),
  paypalWebhookHandler
);
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send({ message: "Server is running..." });
});

startLessonReminderCron();
startAutoBlockCron()

app.use("/v1", routes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

sequelize
  .sync({ alter: true })
  //.authenticate()
  .then(async () => {
    await createDefaultAdmin();
    await initializeDefaultSettings();
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.log(err?.message);
  });
