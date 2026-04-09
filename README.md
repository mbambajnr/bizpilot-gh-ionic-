

```markdown
# BizPilot GH

BizPilot GH is a mobile-first business management MVP built with **Ionic + React + TypeScript** for small and growing businesses. It helps business owners track daily sales, manage inventory, monitor customer balances, and view key business metrics from a simple dashboard.

The project is designed around practical business workflows common in Ghanaian SMEs, including **cash and mobile money payments**, local-first usage, and quick daily record keeping.

---

## Features

### Dashboard
- View daily sales totals
- Track cash collected and mobile money received
- Monitor customer balances
- See low-stock inventory counts
- Review recent business activity
- Visualize weekly revenue trends

### Sales Management
- Record new sales transactions
- Select customer, product, quantity, and payment method
- Support full and partial payments
- Automatically update customer balances
- Automatically reduce inventory quantities after sale

### Inventory Management
- Add new stock items
- Store unit, cost, selling price, opening quantity, and reorder level
- See current stock levels
- Identify low-stock items
- View estimated profit margin per item

### Customer Tracking
- View customer balances
- Track payment status
- See customer channels and recent payment activity

### Local-First Experience
- Business data is persisted in browser/local device storage
- App works as a self-contained MVP without requiring a backend

---

## Tech Stack

- **Ionic React**
- **React**
- **TypeScript**
- **Vite**
- **Capacitor**
- **Vitest**
- **Cypress**
- **ESLint**

---

## Project Structure

```bash
src/
  components/ # Reusable UI components
  context/ # App state and business logic
  data/ # Seed/demo data
  pages/ # Main app screens
  theme/ # App styling and theme variables
  utils/ # Formatting, IDs, helper utilities
```

---

## How It Works

BizPilot GH uses a central business state provider to manage:
- products
- customers
- sales
- derived dashboard metrics

When a sale is recorded:
1. the selected product stock is reduced
2. the sale is added to recent activity
3. customer balances are updated if the payment is partial
4. dashboard numbers update automatically
5. state is saved to local storage

This makes the app a realistic working MVP rather than a static UI demo.

---

## Getting Started

### Prerequisites
Make sure you have installed:
- **Node.js**
- **npm**

### Installation

```bash
git clone https://github.com/mbambajnr/bizpilot-gh-ionic-.git
cd bizpilot-gh-ionic-
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Run unit tests

```bash
npm run test.unit
```

### Run end-to-end tests

```bash
npm run test.e2e
```

### Lint the codebase

```bash
npm run lint
```

---

## Screens Included

- Dashboard
- Sales
- Inventory
- Customers
- Settings

---

## Current Status

This project is currently a **working MVP / prototype**.

It demonstrates:
- business-oriented product thinking
- state-driven UI updates
- local persistence
- practical small-business workflows

It does **not yet include**:
- backend/database integration
- authentication
- cloud sync
- multi-user support
- offline conflict handling
- production reporting/export features

---

## Roadmap

Planned future improvements include:
- edit/delete sales and products
- customer detail pages
- search and filtering
- low-stock alerts
- reporting and exports
- backend integration
- authentication and sync
- improved automated test coverage

---

## Why This Project

Many small businesses need lightweight digital tools that are easy to use, affordable, and relevant to their daily operations. BizPilot GH explores how a simple mobile-first app can support that need with clear, local workflows and practical business visibility.

---

## Author

**King-Adam Mbamba Balika**
GitHub: [mbambajnr](https://github.com/mbambajnr)
LinkedIn: [king-adam-20998b22a](https://www.linkedin.com/in/king-adam-20998b22a)

---

## License

This project is for portfolio and demonstration purposes unless otherwise specified.
