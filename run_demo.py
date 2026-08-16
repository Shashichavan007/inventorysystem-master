import os
import sys
import time
import subprocess
import webbrowser

# Set environment variables for instant local execution without external DB setup
os.environ["DEV_MODE"] = "in_memory"
os.environ["USE_SQLITE"] = "true"

def main():
    print("====================================================================")
    print("  ScaleFlow -- Distributed E-Commerce & Order Processing Platform ")
    print("====================================================================")
    print("[1/3] Initializing local database and seeding default catalog & users...")
    
    # Run seed script
    subprocess.run([sys.executable, "scripts/seed_data.py"], check=True)

    print("\n[2/3] Launching ScaleFlow Microservices & API Gateway...")
    
    processes = []
    services = [
        ("Auth Service", "services/auth-service/app.py", 8001),
        ("Order Service", "services/order-service/app.py", 8002),
        ("Inventory Service", "services/inventory-service/app.py", 8003),
        ("Payment Service", "services/payment-service/app.py", 8004),
        ("Notification Service", "services/notification-service/app.py", 8005),
        ("Analytics Service", "services/analytics-service/app.py", 8006),
        ("API Gateway", "services/api-gateway/app.py", 8000),
    ]

    for name, script, port in services:
        print(f"  -> Starting {name} on port {port}...")
        p = subprocess.Popen([sys.executable, script], env=os.environ.copy())
        processes.append(p)

    time.sleep(3) # Wait for backend services to bind ports

    print("\n[3/3] Starting React SaaS Frontend (Vite)...")
    frontend_dir = os.path.abspath("frontend")
    
    # Check if npm is available
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir, env=os.environ.copy())
    processes.append(frontend_proc)

    time.sleep(2)
    print("\n====================================================================")
    print("  [SUCCESS] ScaleFlow is now live and running locally!")
    print("  Frontend UI:           http://localhost:5173")
    print("  API Gateway:           http://localhost:8000")
    print("  Admin Demo Login:      admin@scaleflow.io / password123")
    print("  Customer Demo Login:   customer@scaleflow.io / password123")
    print("====================================================================")
    print("Press Ctrl+C to terminate all services.\n")

    webbrowser.open("http://localhost:5173")

    try:
        for p in processes:
            p.wait()
    except KeyboardInterrupt:
        print("\nStopping all ScaleFlow microservices...")
        for p in processes:
            p.terminate()
        print("ScaleFlow terminated gracefully.")

if __name__ == "__main__":
    main()
