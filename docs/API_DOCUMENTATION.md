# 🌳 GeoTree Backend — Complete API Documentation

> **Base URL:** `http://localhost:5030`  
> **Auth Header:** `Authorization: Bearer <token>` (required on protected routes)  
> **Content-Type:** `application/json` (unless file upload — use `multipart/form-data`)

---

## 📑 Table of Contents

1. [Health Check](#1-health-check)
2. [Authentication — Mobile App](#2-authentication--mobile-app)
3. [Admin Auth](#3-admin-auth)
4. [Admin Management](#4-admin-management)
5. [Profile](#5-profile)
6. [State](#6-state)
7. [Site / Project](#7-site--project)
8. [Species](#8-species)
9. [Category](#9-category)
10. [Plantation](#10-plantation)
11. [Occasion Types](#11-occasion-types)
12. [Order](#12-order)
13. [Payment](#13-payment)
14. [Certificate](#14-certificate)
15. [Master — Nursery & Certificate Template](#15-master--nursery--certificate-template)
16. [Carbon Footprint](#16-carbon-footprint)
17. [IPL — Campaigns](#17-ipl--campaigns)
18. [IPL — Tournaments](#18-ipl--tournaments)
19. [IPL — Teams](#19-ipl--teams)
20. [IPL — Matches & Dot Balls](#20-ipl--matches--dot-balls)
21. [IPL — App Features](#21-ipl--app-features)
22. [Monitoring](#22-monitoring)
23. [Verification](#23-verification)
24. [Location Data](#24-location-data)
25. [Audit Logs](#25-audit-logs)
26. [Admin UI (Dynamic Models)](#26-admin-ui-dynamic-models)
27. [Occasion Public Routes](#27-occasion-public-routes)
28. [Report Export](#28-report-export)

---

## 1. Health Check

### GET `/api/health`
```
METHOD : GET
URL    : http://localhost:5030/api/health
AUTH   : None
BODY   : None
```

---

## 2. Authentication — Mobile App

### POST `/api/auth/check-number`
Check if mobile number exists (signup / login flow).
```
METHOD : POST
URL    : http://localhost:5030/api/auth/check-number
AUTH   : None
BODY (JSON):
{
  "mobile": "9876543210"
}
```

### POST `/api/auth/verify-otp`
Verify OTP for mobile login.
```
METHOD : POST
URL    : http://localhost:5030/api/auth/verify-otp
AUTH   : None
BODY (JSON):
{
  "mobile": "9876543210",
  "otp": "123456"
}
```

---

## 3. Admin Auth

### POST `/api/admin/auth/login`
Admin login — returns JWT token.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/auth/login
AUTH   : None
BODY (JSON):
{
  "email": "admin@geotree.com",
  "password": "admin123"
}
```

### POST `/api/admin/auth/forgot-password`
Send OTP to email for password reset.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/auth/forgot-password
AUTH   : None
BODY (JSON):
{
  "email": "admin@geotree.com"
}
```

### POST `/api/admin/auth/verify-otp`
Verify OTP sent to email.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/auth/verify-otp
AUTH   : None
BODY (JSON):
{
  "email": "admin@geotree.com",
  "otp": "123456"
}
```

### POST `/api/admin/auth/reset-password`
Reset password using verified OTP.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/auth/reset-password
AUTH   : None
BODY (JSON):
{
  "email": "admin@geotree.com",
  "otp": "123456",
  "new_password": "newSecurePassword123"
}
```

### POST `/api/admin/auth/logout`
Logout admin session.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/auth/logout
AUTH   : Bearer <token>
BODY   : {}
```

---

## 4. Admin Management

### POST `/api/admin/stats`
Get dashboard overview stats.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/stats
AUTH   : Bearer <token>
BODY   : {}
```

### POST `/api/admin/admins/list`
Get list of all admins. *(super_admin only)*
```
METHOD : POST
URL    : http://localhost:5030/api/admin/admins/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "search": ""
}
```

### POST `/api/admin/users/list`
Get list of all app users.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/users/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "search": ""
}
```

### POST `/api/admin/users`
Add a new admin user. *(super_admin only — multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/admin/users
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  name     = "John Doe"
  email    = "john@geotree.com"
  password = "secure123"
  role     = "admin"   // super_admin | admin | finance | field | verification | content
  image    = <file>    // optional profile image
```

### PUT `/api/admin/admins/update`
Update an existing admin. *(super_admin only)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/admin/admins/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id    = "64f1234abc5678def9012345"
  name  = "Updated Name"
  email = "updated@geotree.com"
  role  = "finance"
  image = <file>  // optional
```

### DELETE `/api/admin/admins/delete`
Delete an admin. *(super_admin only)*
```
METHOD : DELETE
URL    : http://localhost:5030/api/admin/admins/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### PUT `/api/admin/users/update`
Update a regular app user.
```
METHOD  : PUT
URL     : http://localhost:5030/api/admin/users/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id            = "64f1234abc5678def9012345"
  name          = "User Name"
  profile_image = <file>  // optional
```

### DELETE `/api/admin/users/delete`
Delete a regular app user.
```
METHOD : DELETE
URL    : http://localhost:5030/api/admin/users/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### POST `/api/admin/profile`
Get current admin's profile.
```
METHOD : POST
URL    : http://localhost:5030/api/admin/profile
AUTH   : Bearer <token>
BODY   : {}
```

### PUT `/api/admin/profile/password`
Change admin password.
```
METHOD : PUT
URL    : http://localhost:5030/api/admin/profile/password
AUTH   : Bearer <token>
BODY (JSON):
{
  "old_password": "currentPass123",
  "new_password": "newPass456"
}
```

---

## 5. Profile

### POST `/api/profile/details`
Get the logged-in user's profile.
```
METHOD : POST
URL    : http://localhost:5030/api/profile/details
AUTH   : Bearer <token>
BODY   : {}
```

### PUT `/api/profile/update`
Update user profile. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/profile/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  name          = "Updated Name"
  profile_image = <file>  // optional
```

### POST `/api/profile/upload-image`
Upload profile image only. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/profile/upload-image
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  profile_image = <file>
```

---

## 6. State

### POST `/api/state/list`
Get all states (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/state/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20,
  "status": true
}
```

### GET `/api/state/hierarchy`
Get state hierarchy (state → district → block).
```
METHOD : GET
URL    : http://localhost:5030/api/state/hierarchy
AUTH   : Bearer <token>
BODY   : None
```

### POST `/api/state/add`
Add a new state. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/state/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  state_name  = "Maharashtra"
  state_image = <file>  // optional
```

### PUT `/api/state/update`
Update state details. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/state/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id          = "64f1234abc5678def9012345"
  state_name  = "Updated State"
  state_image = <file>  // optional
```

### DELETE `/api/state/delete`
Delete a state.
```
METHOD : DELETE
URL    : http://localhost:5030/api/state/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 7. Site / Project

### POST `/api/site/list`
Get all sites / projects (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/site/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "state_id": "64f1234abc5678def9012345",
  "status": true
}
```

### POST `/api/site/add`
Add a new site. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/site/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  site_name   = "Green Valley Site"
  state_id    = "64f1234abc5678def9012345"
  location    = "Near River"
  site_image  = <file>  // optional
```

### PUT `/api/site/update`
Update a site. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/site/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id         = "64f1234abc5678def9012345"
  site_name  = "Updated Site Name"
  site_image = <file>  // optional
```

### DELETE `/api/site/delete`
Delete a site.
```
METHOD : DELETE
URL    : http://localhost:5030/api/site/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### POST `/api/site/upload-boundary`
Upload boundary GeoJSON file for a site. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/site/upload-boundary
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  site_id = "64f1234abc5678def9012345"
  file    = <GeoJSON / KML file>
```

---

## 8. Species

### POST `/api/species/list`
Get all species (also accepts GET, no auth required).
```
METHOD : GET
URL    : http://localhost:5030/api/species/list
AUTH   : None
QUERY PARAMS:
  ?page=1&limit=20&search=neem
```

### POST `/api/species/details`
Get details of a single species.
```
METHOD : POST
URL    : http://localhost:5030/api/species/details
AUTH   : None
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### POST `/api/species/add`
Add a new species. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/species/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  species_name   = "Neem"
  botanical_name = "Azadirachta indica"
  category_id    = "64f1234abc5678def9012345"
  species_image  = <file>  // optional
```

### PUT `/api/species/update`
Update a species. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/species/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id             = "64f1234abc5678def9012345"
  species_name   = "Updated Name"
  species_image  = <file>  // optional
```

### DELETE `/api/species/delete`
Delete a species.
```
METHOD : DELETE
URL    : http://localhost:5030/api/species/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 9. Category

### POST `/api/category/list`
Get all categories (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/category/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20
}
```

### POST `/api/category/add`
Add a new category. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/category/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  category_name  = "Fruit Trees"
  category_image = <file>  // optional
```

### PUT `/api/category/update`
Update a category. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/category/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id             = "64f1234abc5678def9012345"
  category_name  = "Updated Category"
  category_image = <file>  // optional
```

### DELETE `/api/category/delete`
Delete a category.
```
METHOD : DELETE
URL    : http://localhost:5030/api/category/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 10. Plantation

### POST `/api/plantation/plants/list`
Get plant list for plantation flow (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/plants/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "site_id": "64f1234abc5678def9012345",
  "page": 1,
  "limit": 20
}
```

### POST `/api/plantation/plantations/list`
Get all plantations (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/plantations/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "state_id": "64f1234abc5678def9012345",
  "site_id": "64f1234abc5678def9012345",
  "status": "Verified"
}
```

### POST `/api/plantation/plantations/add`
Submit a new plantation record.
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/plantations/add
AUTH   : Bearer <token>
BODY (JSON):
{
  "site_id": "64f1234abc5678def9012345",
  "species_id": "64f1234abc5678def9012346",
  "occasion_id": "64f1234abc5678def9012347",
  "trees_count": 5,
  "latitude": 18.5204,
  "longitude": 73.8567,
  "notes": "Planted near the river"
}
```

### POST `/api/plantation/plantations/history`
Get plantation history of the logged-in user.
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/plantations/history
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### PUT `/api/plantation/plantations/update`
Update a plantation record (admin).
```
METHOD : PUT
URL    : http://localhost:5030/api/plantation/plantations/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345",
  "trees_count": 10,
  "status": "Verified"
}
```

### DELETE `/api/plantation/plantations/delete`
Delete a plantation record (admin).
```
METHOD : DELETE
URL    : http://localhost:5030/api/plantation/plantations/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 11. Occasion Types

### POST `/api/plantation/occasions/list`
Get all occasion types (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/occasions/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20
}
```

### POST `/api/plantation/occasions/add`
Add a new occasion type. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/plantation/occasions/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  occasion_name  = "Birthday"
  occasion_image = <file>  // optional
```

### PUT `/api/plantation/occasions/update`
Update an occasion type. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/plantation/occasions/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id             = "64f1234abc5678def9012345"
  occasion_name  = "Anniversary"
  occasion_image = <file>  // optional
```

### DELETE `/api/plantation/occasions/delete`
Delete an occasion type.
```
METHOD : DELETE
URL    : http://localhost:5030/api/plantation/occasions/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### POST `/api/plantation/occasions/regenerate-forms`
Regenerate HTML forms for all occasions (one-time admin operation).
```
METHOD : POST
URL    : http://localhost:5030/api/plantation/occasions/regenerate-forms
AUTH   : Bearer <token>
BODY   : {}
```

---

## 12. Order

### POST `/api/orders/`
Create a new order.
```
METHOD : POST
URL    : http://localhost:5030/api/orders/
AUTH   : Bearer <token>
BODY (JSON):
{
  "user_id": "64f1234abc5678def9012345",
  "amount": 1500,
  "trees_count": 5,
  "occasion_id": "64f1234abc5678def9012347",
  "species_id": "64f1234abc5678def9012348",
  "site_id": "64f1234abc5678def9012349"
}
```

### POST `/api/orders/user/list`
Get orders of the logged-in user.
```
METHOD : POST
URL    : http://localhost:5030/api/orders/user/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### POST `/api/orders/list`
Get all orders (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/orders/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "order_status": "Pending",
  "search": ""
}
```

### POST `/api/orders/details`
Get details of a single order.
```
METHOD : POST
URL    : http://localhost:5030/api/orders/details
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345"
}
```

### PUT `/api/orders/status`
Update order status.
```
METHOD : PUT
URL    : http://localhost:5030/api/orders/status
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345",
  "order_status": "Assigned",
  "assigned_to": "64f1234abc5678def9012346"
}
```
> **Valid statuses:** `Pending` | `Paid` | `Assigned` | `Executed` | `Verified` | `Completed` | `Cancelled`

### DELETE `/api/orders/delete`
Delete an order (admin).
```
METHOD : DELETE
URL    : http://localhost:5030/api/orders/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345"
}
```

---

## 13. Payment

### POST `/api/payment/initiate`
Initiate a PhonePe payment.
```
METHOD : POST
URL    : http://localhost:5030/api/payment/initiate
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345",
  "amount": 1500,
  "mobile": "9876543210"
}
```

### POST `/api/payment/confirm`
PhonePe callback / confirm payment.
```
METHOD : POST
URL    : http://localhost:5030/api/payment/confirm
AUTH   : None
BODY (JSON):
{
  "transactionId": "TXN123456",
  "merchantTransactionId": "MT123456",
  "code": "PAYMENT_SUCCESS"
}
```

### POST `/api/payment/list`
List all payments (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/payment/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10,
  "status": "SUCCESS"
}
```

### GET `/api/payment/stats`
Get payment revenue stats (admin/finance).
```
METHOD : GET
URL    : http://localhost:5030/api/payment/stats
AUTH   : Bearer <token>
BODY   : None
```

---

## 14. Certificate

### POST `/api/certificate/list`
List all certificates (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/certificate/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### POST `/api/certificate/details`
Get details of a certificate.
```
METHOD : POST
URL    : http://localhost:5030/api/certificate/details
AUTH   : Bearer <token>
BODY (JSON):
{
  "certificate_id": "64f1234abc5678def9012345"
}
```

### POST `/api/certificate/generate`
Generate a new certificate for an order.
```
METHOD : POST
URL    : http://localhost:5030/api/certificate/generate
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345",
  "template_id": "64f1234abc5678def9012346",
  "recipient_name": "John Doe"
}
```

### POST `/api/certificate/download`
Download a certificate.
```
METHOD : POST
URL    : http://localhost:5030/api/certificate/download
AUTH   : Bearer <token>
BODY (JSON):
{
  "certificate_id": "64f1234abc5678def9012345"
}
```

### PUT `/api/certificate/update`
Update a certificate (admin).
```
METHOD : PUT
URL    : http://localhost:5030/api/certificate/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "certificate_id": "64f1234abc5678def9012345",
  "recipient_name": "Jane Doe"
}
```

### DELETE `/api/certificate/delete`
Delete a certificate (admin).
```
METHOD : DELETE
URL    : http://localhost:5030/api/certificate/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "certificate_id": "64f1234abc5678def9012345"
}
```

### GET `/api/certificate/view/:certificate_id`
View a certificate as HTML page (public link).
```
METHOD : GET
URL    : http://localhost:5030/api/certificate/view/64f1234abc5678def9012345
AUTH   : None
BODY   : None
```

---

## 15. Master — Nursery & Certificate Template

### GET `/api/master/nursery/list`
Get all nurseries (also accepts POST).
```
METHOD : GET
URL    : http://localhost:5030/api/master/nursery/list
AUTH   : None
BODY   : None
```

### POST `/api/master/nursery/add`
Add a new nursery. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/master/nursery/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  nursery_name   = "Green Nursery"
  location       = "Pune"
  nursery_image  = <file>  // optional
```

### PUT `/api/master/nursery/update`
Update a nursery. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/master/nursery/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id             = "64f1234abc5678def9012345"
  nursery_name   = "Updated Nursery"
  nursery_image  = <file>  // optional
```

### DELETE `/api/master/nursery/delete`
Delete a nursery.
```
METHOD : DELETE
URL    : http://localhost:5030/api/master/nursery/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### GET `/api/master/template/list`
Get all certificate templates (also accepts POST).
```
METHOD : GET
URL    : http://localhost:5030/api/master/template/list
AUTH   : None
BODY   : None
```

### POST `/api/master/template/add`
Add a new certificate template. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/master/template/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  template_name     = "Standard Certificate"
  background_image  = <file>
```

### PUT `/api/master/template/update`
Update a certificate template. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/master/template/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id                = "64f1234abc5678def9012345"
  template_name     = "Updated Template"
  background_image  = <file>  // optional
```

### DELETE `/api/master/template/delete`
Delete a certificate template.
```
METHOD : DELETE
URL    : http://localhost:5030/api/master/template/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 16. Carbon Footprint

### POST `/api/carbon/calculate`
Submit carbon footprint calculation.
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/calculate
AUTH   : Bearer <token>
BODY (JSON):
{
  "transport": [
    { "type_id": "64f1234abc5678def9012345", "distance_km": 50, "frequency": "Daily" }
  ],
  "electricity": [
    { "type_id": "64f1234abc5678def9012346", "units": 200 }
  ],
  "food": [
    { "type_id": "64f1234abc5678def9012347", "servings_per_day": 3 }
  ]
}
```

### POST `/api/carbon/result`
Get the last carbon calculation result.
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/result
AUTH   : Bearer <token>
BODY (JSON):
{
  "calculation_id": "64f1234abc5678def9012345"
}
```

### POST `/api/carbon/history`
Get user's carbon calculation history.
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/history
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### GET `/api/carbon/transport-types`
Get reference transport types (public).
```
METHOD : GET
URL    : http://localhost:5030/api/carbon/transport-types
AUTH   : None
```

### GET `/api/carbon/electricity-types`
Get electricity types (public).
```
METHOD : GET
URL    : http://localhost:5030/api/carbon/electricity-types
AUTH   : None
```

### GET `/api/carbon/food-types`
Get food types (public).
```
METHOD : GET
URL    : http://localhost:5030/api/carbon/food-types
AUTH   : None
```

### GET `/api/carbon/emission-factors`
Get all emission factors (public).
```
METHOD : GET
URL    : http://localhost:5030/api/carbon/emission-factors
AUTH   : None
```

### POST `/api/carbon/emission-factors/list`
Get emission factors (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/emission-factors/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20
}
```

### POST `/api/carbon/emission-factors/add`
Add an emission factor. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/carbon/emission-factors/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  name   = "Car - Petrol"
  type   = "transport"
  factor = 0.21
  unit   = "kg CO2/km"
  image  = <file>  // optional
```

### PUT `/api/carbon/emission-factors/update`
Update an emission factor. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/carbon/emission-factors/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  id     = "64f1234abc5678def9012345"
  factor = 0.19
  image  = <file>  // optional
```

### DELETE `/api/carbon/emission-factors/delete`
Delete an emission factor.
```
METHOD : DELETE
URL    : http://localhost:5030/api/carbon/emission-factors/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

### POST `/api/carbon/offset-factors/list`
Get offset factors (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/offset-factors/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20
}
```

### POST `/api/carbon/offset-factors/add`
Add an offset factor.
```
METHOD : POST
URL    : http://localhost:5030/api/carbon/offset-factors/add
AUTH   : Bearer <token>
BODY (JSON):
{
  "name": "Deciduous Tree",
  "offset_per_year": 22,
  "unit": "kg CO2/year"
}
```

### PUT `/api/carbon/offset-factors/update`
Update an offset factor.
```
METHOD : PUT
URL    : http://localhost:5030/api/carbon/offset-factors/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345",
  "offset_per_year": 25
}
```

### DELETE `/api/carbon/offset-factors/delete`
Delete an offset factor.
```
METHOD : DELETE
URL    : http://localhost:5030/api/carbon/offset-factors/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "id": "64f1234abc5678def9012345"
}
```

---

## 17. IPL — Campaigns

### POST `/api/ipl/campaigns/list`
Get list of campaigns (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/campaigns/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### POST `/api/ipl/campaigns/add`
Add a new campaign (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/campaigns/add
AUTH   : Bearer <token>
BODY (JSON):
{
  "campaign_name": "IPL 2025",
  "start_date": "2025-03-15",
  "end_date": "2025-05-30",
  "description": "IPL cricket campaign for tree plantation"
}
```

### PUT `/api/ipl/campaigns/update`
Update a campaign (admin).
```
METHOD : PUT
URL    : http://localhost:5030/api/ipl/campaigns/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "campaign_id": "64f1234abc5678def9012345",
  "campaign_name": "IPL 2025 Updated",
  "end_date": "2025-06-01"
}
```

### DELETE `/api/ipl/campaigns/delete`
Delete a campaign (admin).
```
METHOD : DELETE
URL    : http://localhost:5030/api/ipl/campaigns/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "campaign_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/config/details`
Get IPL configuration details.
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/config/details
AUTH   : Bearer <token>
BODY   : {}
```

### PUT `/api/ipl/config`
Update IPL configuration (admin).
```
METHOD : PUT
URL    : http://localhost:5030/api/ipl/config
AUTH   : Bearer <token>
BODY (JSON):
{
  "trees_per_dot_ball": 1,
  "max_dot_balls_per_match": 50,
  "active_campaign_id": "64f1234abc5678def9012345"
}
```

---

## 18. IPL — Tournaments

### POST `/api/ipl/tournaments/list`
Get list of tournaments (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/tournaments/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### POST `/api/ipl/tournaments/leaderboard`
Get tournament leaderboard (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/tournaments/leaderboard
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/tournaments`
Add a new tournament. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/ipl/tournaments
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  tournament_name = "IPL 2025"
  campaign_id     = "64f1234abc5678def9012345"
  start_date      = "2025-03-20"
  end_date        = "2025-05-25"
  image           = <file>  // optional
```

### PUT `/api/ipl/tournaments`
Update a tournament. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/ipl/tournaments
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  tournament_id   = "64f1234abc5678def9012345"
  tournament_name = "IPL 2025 Updated"
  image           = <file>  // optional
```

### DELETE `/api/ipl/tournaments/:tournament_id`
Delete a tournament by URL param.
```
METHOD : DELETE
URL    : http://localhost:5030/api/ipl/tournaments/64f1234abc5678def9012345
AUTH   : Bearer <token>
BODY   : None
```

### DELETE `/api/ipl/tournaments/delete`
Delete a tournament by body ID.
```
METHOD : DELETE
URL    : http://localhost:5030/api/ipl/tournaments/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345"
}
```

---

## 19. IPL — Teams

### POST `/api/ipl/teams/list`
Get all teams (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/teams/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345",
  "page": 1,
  "limit": 20
}
```

### POST `/api/ipl/teams`
Add a new team. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/ipl/teams
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  team_name      = "Mumbai Indians"
  team_full_name = "Mumbai Indians FC"
  team_color     = "#004BA0"
  primary_color  = "#D1AB3E"
  team_logo      = <file>  // optional
```

### PUT `/api/ipl/teams/update`
Update a team. *(multipart/form-data)*
```
METHOD  : PUT
URL     : http://localhost:5030/api/ipl/teams/update
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  team_id    = "64f1234abc5678def9012345"
  team_name  = "MI Updated"
  team_logo  = <file>  // optional
```

### DELETE `/api/ipl/teams/delete`
Delete a team.
```
METHOD : DELETE
URL    : http://localhost:5030/api/ipl/teams/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "team_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/teams/details`
Get team details (app).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/teams/details
AUTH   : Bearer <token>
BODY (JSON):
{
  "team_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/teams/support`
Pre-plant support for a team (app).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/teams/support
AUTH   : Bearer <token>
BODY (JSON):
{
  "team_id": "64f1234abc5678def9012345",
  "tournament_id": "64f1234abc5678def9012346"
}
```

### POST `/api/ipl/teams/upload-image`
Upload team logo. *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/ipl/teams/upload-image
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  team_id   = "64f1234abc5678def9012345"
  team_logo = <file>
```

---

## 20. IPL — Matches & Dot Balls

### POST `/api/ipl/matches/list`
Get all matches (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/matches/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345",
  "match_status": "Upcoming",
  "page": 1,
  "limit": 10
}
```

### POST `/api/ipl/matches`
Add a new match.
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/matches
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345",
  "team1_id": "64f1234abc5678def9012346",
  "team2_id": "64f1234abc5678def9012347",
  "match_date": "2025-04-10",
  "match_time": "19:30",
  "venue": "Wankhede Stadium",
  "match_type": "League",
  "match_status": "Upcoming"
}
```
> **match_type:** `League` | `Playoff` | `Final`  
> **match_status:** `Upcoming` | `Live` | `Completed`

### PUT `/api/ipl/matches/update`
Update a match (admin).
```
METHOD : PUT
URL    : http://localhost:5030/api/ipl/matches/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "match_id": "64f1234abc5678def9012345",
  "match_status": "Live",
  "venue": "Eden Gardens"
}
```

### DELETE `/api/ipl/matches/delete`
Delete a match (admin).
```
METHOD : DELETE
URL    : http://localhost:5030/api/ipl/matches/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "match_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/matches/dot-balls/details`
Get dot ball details for a match.
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/matches/dot-balls/details
AUTH   : Bearer <token>
BODY (JSON):
{
  "match_id": "64f1234abc5678def9012345"
}
```

### PUT `/api/ipl/matches/dot-balls`
Update dot balls count for a team in a match.
```
METHOD : PUT
URL    : http://localhost:5030/api/ipl/matches/dot-balls
AUTH   : Bearer <token>
BODY (JSON):
{
  "match_id": "64f1234abc5678def9012345",
  "team_id": "64f1234abc5678def9012346",
  "dot_balls": 12
}
```

### POST `/api/ipl/matches/support`
User supports trees for a match (app).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/matches/support
AUTH   : Bearer <token>
BODY (JSON):
{
  "match_id": "64f1234abc5678def9012345",
  "team_id": "64f1234abc5678def9012346"
}
```

---

## 21. IPL — App Features

### POST `/api/ipl/history`
Get dot ball history for the logged-in user (app).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/history
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### POST `/api/ipl/challenge`
Get team challenge data (also accepts GET).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/challenge
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345"
}
```

### POST `/api/ipl/challenge/update`
Update/add team challenge (admin).
```
METHOD : POST
URL    : http://localhost:5030/api/ipl/challenge/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "tournament_id": "64f1234abc5678def9012345",
  "team_id": "64f1234abc5678def9012346",
  "challenge_target": 100
}
```

---

## 22. Monitoring

### GET `/api/monitoring/data`
Get monitoring data (public / app).
```
METHOD : GET
URL    : http://localhost:5030/api/monitoring/data
AUTH   : None
QUERY PARAMS:
  ?site_id=64f1234abc5678def9012345&page=1&limit=10
```

### POST `/api/monitoring/add`
Add a monitoring record. *(multipart/form-data — up to 5 media files)*
```
METHOD  : POST
URL     : http://localhost:5030/api/monitoring/add
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  plantation_id = "64f1234abc5678def9012345"
  notes         = "Tree is growing well"
  health_status = "Healthy"
  media         = <file1>, <file2>  // up to 5 files
```

### PUT `/api/monitoring/update`
Update a monitoring record.
```
METHOD : PUT
URL    : http://localhost:5030/api/monitoring/update
AUTH   : Bearer <token>
BODY (JSON):
{
  "monitoring_id": "64f1234abc5678def9012345",
  "notes": "Updated: tree growing well",
  "health_status": "Healthy"
}
```

### DELETE `/api/monitoring/delete`
Delete a monitoring record.
```
METHOD : DELETE
URL    : http://localhost:5030/api/monitoring/delete
AUTH   : Bearer <token>
BODY (JSON):
{
  "monitoring_id": "64f1234abc5678def9012345"
}
```

---

## 23. Verification

> **Role required:** `verification` or `super_admin`

### POST `/api/verification/list`
Get pending verifications.
```
METHOD : POST
URL    : http://localhost:5030/api/verification/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 10
}
```

### PUT `/api/verification/verify`
Verify or reject an order.
```
METHOD : PUT
URL    : http://localhost:5030/api/verification/verify
AUTH   : Bearer <token>
BODY (JSON):
{
  "order_id": "64f1234abc5678def9012345",
  "status": "Verified",
  "remarks": "All documents verified"
}
```

---

## 24. Location Data

### GET `/api/location-data/states`
Get all states for dropdowns (public).
```
METHOD : GET
URL    : http://localhost:5030/api/location-data/states
AUTH   : None
```

### GET `/api/location-data/districts`
Get districts for a state (public).
```
METHOD : GET
URL    : http://localhost:5030/api/location-data/districts?state_id=64f1234abc5678def9012345
AUTH   : None
```

### GET `/api/location-data/blocks`
Get blocks for a district (public).
```
METHOD : GET
URL    : http://localhost:5030/api/location-data/blocks?district_id=64f1234abc5678def9012345
AUTH   : None
```

### GET `/api/location-data/gps`
Get Gram Panchayats (public).
```
METHOD : GET
URL    : http://localhost:5030/api/location-data/gps?block_id=64f1234abc5678def9012345
AUTH   : None
```

### GET `/api/location-data/villages`
Get villages (public).
```
METHOD : GET
URL    : http://localhost:5030/api/location-data/villages?gp_id=64f1234abc5678def9012345
AUTH   : None
```

### POST `/api/location-data/upload-excel`
Upload location data via Excel file (admin). *(multipart/form-data)*
```
METHOD  : POST
URL     : http://localhost:5030/api/location-data/upload-excel
AUTH    : Bearer <token>
CONTENT : multipart/form-data
FIELDS:
  file = <Excel file (.xlsx or .xls)>
```

---

## 25. Audit Logs

> **Role required:** `super_admin`

### POST `/api/audit/list`
Get audit logs.
```
METHOD : POST
URL    : http://localhost:5030/api/audit/list
AUTH   : Bearer <token>
BODY (JSON):
{
  "page": 1,
  "limit": 20,
  "entity": "Admin",
  "action": "PASSWORD_CHANGE"
}
```

---

## 26. Admin UI (Dynamic Models)

> **Role required:** `super_admin` or `admin`

### GET `/api/admin-ui/models`
Get list of all available DB models.
```
METHOD : GET
URL    : http://localhost:5030/api/admin-ui/models
AUTH   : Bearer <token>
```

### GET `/api/admin-ui/models/:modelName`
Get records for a specific model.
```
METHOD : GET
URL    : http://localhost:5030/api/admin-ui/models/User
AUTH   : Bearer <token>
QUERY PARAMS:
  ?page=1&limit=10
```

### GET `/api/admin-ui/models/:modelName/:id`
Get a single record.
```
METHOD : GET
URL    : http://localhost:5030/api/admin-ui/models/User/64f1234abc5678def9012345
AUTH   : Bearer <token>
```

### POST `/api/admin-ui/models/:modelName`
Create a record in a model.
```
METHOD : POST
URL    : http://localhost:5030/api/admin-ui/models/User
AUTH   : Bearer <token>
BODY (JSON):
{
  "name": "Test User",
  "email": "test@geotree.com"
}
```

### PUT `/api/admin-ui/models/:modelName/:id`
Update a record.
```
METHOD : PUT
URL    : http://localhost:5030/api/admin-ui/models/User/64f1234abc5678def9012345
AUTH   : Bearer <token>
BODY (JSON):
{
  "name": "Updated Name"
}
```

### DELETE `/api/admin-ui/models/:modelName/:id`
Delete a record.
```
METHOD : DELETE
URL    : http://localhost:5030/api/admin-ui/models/User/64f1234abc5678def9012345
AUTH   : Bearer <token>
```

---

## 27. Occasion Public Routes

These routes are used by the standalone plantation form (no auth required).

### GET `/occasion/list/:id`
Get occasion details by ID.
```
METHOD : GET
URL    : http://localhost:5030/occasion/list/64f1234abc5678def9012345
AUTH   : None
```

### GET `/occasion/states`
Get active states list for dropdown.
```
METHOD : GET
URL    : http://localhost:5030/occasion/states
AUTH   : None
```

### POST `/occasion/projects`
Get site/project list filtered by state.
```
METHOD : POST
URL    : http://localhost:5030/occasion/projects
AUTH   : None
BODY (JSON):
{
  "state_id": "64f1234abc5678def9012345"
}
```

### POST `/occasion/species`
Get species list filtered by project/site.
```
METHOD : POST
URL    : http://localhost:5030/occasion/species
AUTH   : None
BODY (JSON):
{
  "project_id": "64f1234abc5678def9012345"
}
```

---

## 28. Report Export

### POST `/api/reports/export`
Export orders report as file (admin/finance).
```
METHOD : POST
URL    : http://localhost:5030/api/reports/export
AUTH   : Bearer <token>
BODY (JSON):
{
  "format": "csv",
  "from_date": "2025-01-01",
  "to_date": "2025-03-31",
  "order_status": "Completed"
}
```

---

## 🔑 Quick Reference — Role Permissions

| Role           | Access Level                                      |
|----------------|---------------------------------------------------|
| `super_admin`  | Full access to all endpoints                      |
| `admin`        | Most admin CRUD, no admin user management         |
| `finance`      | Payment stats, reports, order list                |
| `field`        | Order status update, certificate generation       |
| `verification` | Verification list and verify action               |
| `content`      | Content-level access (limited)                    |

---

## 📌 Common Request Notes

- **Encrypted Body:** Many routes use `decryptionMiddleware`. In **development**, raw JSON works fine.
- **Auth Token:** Set `Authorization: Bearer <your_jwt_token>` header on all protected routes.
- **Pagination:** Most list endpoints accept `{ "page": 1, "limit": 10 }` in the body.
- **File Uploads:** Use `Content-Type: multipart/form-data` — do NOT set `application/json` for these.
- **Default Port:** `5030` (see `.env` → `PORT=5030`)
- **Default Super Admin:** `admin@geotree.com` / `admin123`
