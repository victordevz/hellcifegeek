import { Database } from "../domain";

export const seedDatabase = {
  "users": [],
  "categories": [
    {
      "id": "ee545157-b422-46c3-8c82-f58602a52443",
      "name": "Action Figures",
      "slug": "action-figures",
      "createdAt": "2026-05-25T03:37:40.007Z",
      "updatedAt": "2026-05-25T03:37:40.007Z"
    }
  ],
  "products": [
    {
      "id": "e2c880bb-cc7b-4f7c-b22a-310b2fe0a8fb",
      "name": "Charizard GameFreak Colab TOKYOTV LACRADO",
      "priceCents": 14999,
      "stock": 1,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/491f8056-71da-4d37-bb3d-bf1718a50325.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/491f8056-71da-4d37-bb3d-bf1718a50325.png",
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/3e5bc254-9325-43ce-886a-e0b247101fd8.png",
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/89a74727-e103-42f4-8311-8ab77de2efaf.png"
      ],
      "tags": [
        "action figure",
        "gamefreak"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": true,
      "createdAt": "2026-05-25T23:45:12.510Z",
      "updatedAt": "2026-05-25T23:54:52.421Z"
    },
    {
      "id": "ebaae62b-afc3-463c-a622-af673ccb2729",
      "name": "Gengar GameFreak Openbox Colab TOKYOTV",
      "priceCents": 9999,
      "stock": 1,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/f5aaa674-1bd5-459d-a188-5e714bcdbc82.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/f5aaa674-1bd5-459d-a188-5e714bcdbc82.png",
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/c6228611-302b-4167-9fd6-fb1e379f09bc.png",
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/08c089b0-3745-4a8f-9479-fcafea162ff5.png"
      ],
      "tags": [
        "action figure",
        "gamefreak"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": true,
      "createdAt": "2026-05-25T23:48:35.416Z",
      "updatedAt": "2026-05-25T23:55:04.806Z"
    },
    {
      "id": "78cf4e2b-4992-4ed5-afce-bba2636d5974",
      "name": "PSYDUCK GameFreak Openbox Colab TOKYOTV",
      "priceCents": 7999,
      "stock": 1,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/69774468-ed9f-432b-a040-3a362444df79.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/69774468-ed9f-432b-a040-3a362444df79.png"
      ],
      "tags": [
        "action figure",
        "gamefreak"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": false,
      "createdAt": "2026-05-25T23:50:29.467Z",
      "updatedAt": "2026-05-25T23:55:58.239Z"
    },
    {
      "id": "19cd4aa2-2587-445e-8f7f-1037316e064f",
      "name": "Eeve GameFreak Openbox Colab TOKYOTV",
      "priceCents": 7999,
      "stock": 1,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/9af65dae-b98a-4dd0-b91c-20ffd28ee0a3.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/9af65dae-b98a-4dd0-b91c-20ffd28ee0a3.png"
      ],
      "tags": [
        "action figure",
        "gamefreak"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": false,
      "createdAt": "2026-05-25T23:54:27.995Z",
      "updatedAt": "2026-05-25T23:54:27.995Z"
    },
    {
      "id": "af54a4de-78a9-41e6-bc3b-a84850d9f98e",
      "name": "Snorlax GameFreak Openbox Colab Sleep Hour",
      "priceCents": 5999,
      "stock": 1,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/9991f473-dd13-4678-b8ba-e5d2fc1d64b1.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/9991f473-dd13-4678-b8ba-e5d2fc1d64b1.png",
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/a72ba567-4da3-4652-9055-0f3dbaa90d93.png"
      ],
      "tags": [
        "action figure",
        "gamefreak"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": false,
      "createdAt": "2026-05-25T23:57:59.304Z",
      "updatedAt": "2026-05-25T23:57:59.304Z"
    },
    {
      "id": "4006e558-1683-4303-b96c-f86ce7b5d465",
      "name": "Loot Box Pokebola",
      "priceCents": 999,
      "stock": 12,
      "currency": "BRL",
      "photoUrl": "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/1512e667-8b46-48f3-b7e5-eb1c5bd29153.png",
      "photoUrls": [
        "https://vweeudkxylekqiukjazw.supabase.co/storage/v1/object/public/images/products/2026-05-25/1512e667-8b46-48f3-b7e5-eb1c5bd29153.png"
      ],
      "tags": [
        "action figure",
        "lootbox"
      ],
      "categoryId": "ee545157-b422-46c3-8c82-f58602a52443",
      "active": true,
      "recommended": true,
      "createdAt": "2026-05-25T23:59:47.336Z",
      "updatedAt": "2026-05-25T23:59:47.336Z"
    }
  ],
  "partnerPurchases": [],
  "payments": [],
  "raffleEntries": []
} satisfies Database;
