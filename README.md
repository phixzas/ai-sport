# FORMLY Sports Predictions

## Required services and setup

The site stores accounts, subscriptions, and generated prediction results in MongoDB Atlas. Passwords are salted and hashed on the server; model access uses signed, expiring tokens. Paystack remains the payment provider.

1. In your existing MongoDB Atlas project, create a database user with read/write access only to the `formly` database. Copy its connection URI; URL-encode special characters in the password. Allow the Render service to connect through Atlas Network Access.
2. Set the website environment variables from `.env.example` in Render. Generate a unique `AUTH_TOKEN_SECRET` with at least 32 random bytes. Keep the MongoDB URI, token secret, and Paystack secret private.
3. Configure Paystack to send transaction webhooks to `/api/payments/webhook` on the deployed website. Access is granted only after the server verifies the transaction; duplicate webhook deliveries do not extend a plan twice.
4. Deploy the Premier League and NBA FastAPI projects as separate web services. Set each service's `FORMLY_API_URL` to the website URL. Use `python -m uvicorn api:app --host 0.0.0.0 --port $PORT` as the start command. The API checks the user's signed token and active subscription with the website before returning teams or predictions.
5. Set the website's `FORMLY_FOOTBALL_API_URL` and `FORMLY_NBA_API_URL` to the deployed API service URLs. The dashboard calls the website's authenticated model routes, which proxy requests to the matching FastAPI service; it does not use the Streamlit apps.
6. Keep model repositories private or move model files to private storage. A public repository can expose downloadable model files even when its API checks subscriptions.
7. Deploy this project to Render as a **Web Service**, not a Static Site. The included `render.yaml` uses a paid Starter instance because authentication and payment verification need a running server.

NBA access is ₦10,000 for 30 days; Football access is ₦50,000 for 30 days. This implementation does not send account-confirmation emails.

## Development

```bash
npm install
npm run dev
```

Set up the two model services in separate terminals (install each project's `requirements.txt` first). Run each command from its model project folder:

```powershell
# Premier League project, in its own terminal
Set-Location "C:\Users\user\Desktop\Premier league"
$env:FORMLY_API_URL = "http://localhost:3000"
.\.venv\Scripts\python.exe -m uvicorn api:app --reload --port 8002
```

```powershell
# NBA project, in a second terminal
Set-Location "C:\Users\user\Desktop\Basket ball"
$env:FORMLY_API_URL = "http://localhost:3000"
.\.venv\Scripts\python.exe -m uvicorn api:app --reload --port 8001
```

In the website's `.env.local`, set `FORMLY_FOOTBALL_API_URL=http://127.0.0.1:8002` and `FORMLY_NBA_API_URL=http://127.0.0.1:8001`, `MONGODB_URI` to your Atlas connection string, `MONGODB_DB_NAME=formly`, and `AUTH_TOKEN_SECRET` to a random secret of at least 32 bytes. Payment return URLs use the origin of the site where checkout began. URL-encode special characters in the database user's password and add your current IP in Atlas Network Access. The app creates its `formly` database and `users`, `subscriptions`, and `predictions` collections on first use; each saved prediction includes its user, sport, inputs, result, and creation time. Keep `.env.local` private. Then restart the website and open `http://localhost:3000`.
