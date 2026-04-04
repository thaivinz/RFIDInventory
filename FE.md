# Frontend Refactor Plan

## Goal
Tai cau truc `web/src` theo huong `Next.js App Router` + chia module theo tung nghiep vu de:
- de doc
- de chia viec
- de mo rong
- giu moi file ngan va ro trach nhiem

Pham vi refactor la tang dan, giu nguyen URL va hanh vi hien tai, khong lam lai toan bo giao dien.

## Decisions Locked In
- Refactor tang dan, khong dap di xay lai
- Giu co che dang nhap phia client nhu hien tai
- Khong doi duong dan public
- Khong doi manh giao dien
- `app/` chi lo route va layout
- Logic nghiep vu dua vao `features/`
- Component dung chung de o `components/ui`
- Ha tang frontend de o `lib/`

## Target Structure
```txt
web/src/
  app/
    (auth)/
      login/page.tsx
      layout.tsx
    (dashboard)/
      layout.tsx
      page.tsx
      categories/page.tsx
      products/page.tsx
      tags/page.tsx
      users/page.tsx
      inventory/page.tsx
      orders/page.tsx
      sessions/page.tsx
      activity-logs/page.tsx

  features/
    auth/
      api/
      components/
      hooks/
      types.ts
    categories/
      api/
      components/
      hooks/
      types.ts
      mappers.ts
    products/
      api/
      components/
      hooks/
      types.ts
      mappers.ts
    tags/
      api/
      components/
      hooks/
      types.ts
      mappers.ts
    users/
      api/
      components/
      hooks/
      types.ts
      mappers.ts
    inventory/
    orders/
    sessions/
    activity-logs/

  components/
    ui/
    layout/

  lib/
    http/
      client.ts
      errors.ts
      auth-storage.ts
    utils/
    constants/

  providers/
    auth-provider.tsx
    query-provider.tsx

  types/
    api.ts
    common.ts
```

## Implementation Rules

### 1. App Router Boundaries
- `app/` chi giu `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, metadata
- Tach 2 route group:
  - `(auth)` cho man dang nhap
  - `(dashboard)` cho khu vuc sau dang nhap
- `app/layout.tsx` chi giu font, CSS global va providers
- `app/(auth)/layout.tsx` chi render layout cua trang dang nhap
- `app/(dashboard)/layout.tsx` render shell da dang nhap: sidebar, content area, auth gate

Expected result:
- khong con kiem tra `pathname === '/login'` trong shell tong
- khong con mot layout client om moi truong hop
- route va layout tach ro trach nhiem

### 2. Feature-First Modules
Moi domain la mot module rieng trong `features/`, vi du `products`, `categories`, `tags`, `users`.

Ben trong moi feature:
- `api/`: ham goi API cua domain
- `hooks/`: query hook, mutation hook, helper state
- `components/`: table, form, dialog, filter, page client
- `types.ts`: type dung trong frontend
- `mappers.ts`: chuan hoa du lieu tra ve tu backend

Mandatory rules:
- `page.tsx` khong goi API truc tiep
- `page.tsx` khong chua ca query, mutation, form state, modal state, table markup trong cung file
- Component chi dung cho mot feature thi de trong feature do
- Chi dua sang `components/ui` khi la component dung chung thuc su

### 3. Shared HTTP Layer
Thay file API tong bang:
- `lib/http/client.ts`: wrapper `fetch`, header, token, parse loi, xu ly 401
- `lib/http/errors.ts`: chuan hoa loi
- `lib/http/auth-storage.ts`: doc/ghi access token, refresh token
- `features/*/api/*.ts`: API theo tung nghiep vu

Vi du:
- `features/products/api/get-products.ts`
- `features/products/api/create-product.ts`
- `features/auth/api/login.ts`

Convention:
- `client.ts` chi lo giao tiep HTTP
- Feature API chi lo endpoint cua nghiep vu do
- UI khong tu xu ly response lon xon kieu `data?.data ?? data ?? []`
- Normalize response o mot noi co dinh

### 4. Auth Boundary In This Phase
Giu `localStorage` trong phase nay, nhung gom ve dung ranh gioi:

`AuthProvider` chi lo:
- bootstrap token
- current user
- login
- logout
- loading state

Quy tac auth:
- `auth-storage.ts` la noi duy nhat doc/ghi token
- Login page chi lo form va submit
- Dashboard layout hoac `AuthGate` lo chan route can dang nhap
- Sidebar va layout chi doc auth state qua provider

Not in this phase:
- chuyen sang cookie/session
- middleware auth
- server auth

But must prepare for next phase:
- khong doc `localStorage` rai rac
- khong tron auth logic vao page

### 5. File Size Rules
Quy uoc co dinh:
- `app/**/page.tsx`: muc tieu `20-60` dong, tran `100`
- `features/*/components/*page-client.tsx`: muc tieu `80-150` dong, tran `200`
- Component `table`, `dialog`, `filters`: muc tieu `60-180` dong
- Hook: `20-80` dong, mot trach nhiem ro rang
- Moi file API: `20-80` dong, chi mot endpoint hoac mot nhom rat gan nhau

Bat buoc tach neu:
- mot file co ca `filters + table + modal + mutation handlers`
- mot file vua fetch du lieu vua chua nhieu khoi UI lon
- mot page vuot nguong dong da chot

## Standard Feature Template
Vi du `products`:

```txt
features/products/
  api/
    get-products.ts
    create-product.ts
    update-product.ts
    delete-product.ts
  components/
    products-page-client.tsx
    products-table.tsx
    product-filters.tsx
    product-form-dialog.tsx
    delete-product-dialog.tsx
  hooks/
    use-products-list.ts
    use-product-mutations.ts
  types.ts
  mappers.ts
```

Roles:
- `products-page-client.tsx`: orchestration cap man hinh
- `use-products-list.ts`: query, params, query key
- `use-product-mutations.ts`: create, update, delete, invalidate cache
- `products-table.tsx`: chi render bang
- `product-filters.tsx`: chi filter
- `product-form-dialog.tsx`: form create/edit
- `delete-product-dialog.tsx`: xac nhan xoa
- `mappers.ts`: chuyen response backend thanh shape frontend de dung

## Required Execution Order
1. Nen tang chung
- tao route groups
- tach layout
- chuan hoa `providers`
- tao `lib/http`
- tao `types/api.ts`, `types/common.ts`

2. Auth
- login page
- auth provider
- auth storage

3. Categories
- dung lam mau cho CRUD don gian

4. Products
- dung lam mau cho CRUD + filter + phan trang

5. Users
- them pattern kiem tra quyen o UI

6. Tags
- refactor sau cung trong nhom CRUD vi phuc tap nhat

7. Cac phan con lai
- inventory
- orders
- sessions
- activity-logs

Do not start from `tags`.

## Testing Checklist Per Feature
Sau moi feature duoc tach ra, phai kiem tra:
- route cu van chay dung
- danh sach tai dung
- tao moi hoat dong
- cap nhat hoat dong
- xoa hoat dong
- loading state hoat dong
- error state hoat dong
- invalidate query lam moi du lieu dung
- search, filter, pagination giu dung hanh vi cu

## Done Criteria
- khong con page nao om toan bo logic man hinh
- `lib/api.ts` bi loai bo hoan toan
- toan bo goi API di qua `lib/http/client.ts` + feature API files
- khong con cho doc token truc tiep ngoai auth/http helper
- file duoc tach dung nguong do dai da chot

## Assumptions
- Giu nguyen URL hien tai
- Giu nguyen trai nghiem hien tai tru khi can chinh nho de tach code
- Chua chuyen sang server component hoac cookie auth
- Khong dung kien truc qua nang; uu tien cau truc ro, thuc dung, de code
- `categories` la mau chuan dau tien
- `products` la mau chuan thu hai
- `tags` chi lam sau khi hai mau dau da on

## Notes For The Team
- Uu tien refactor theo tung feature nho, merge som, tranh mot PR qua lon
- Moi page moi hoac page sau refactor nen giu vai tro mong, chu yeu la noi vao page-client component
- Neu mot component chua chac co dung chung hay khong, mac dinh de trong feature truoc
- Neu backend response chua dong nhat, xu ly trong `mappers.ts` hoac feature API, khong day sang UI
