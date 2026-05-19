# MCP Image/Video Generation Architecture Plan

## Context

Tujuan dokumen ini adalah merancang MCP lokal yang berfungsi sebagai thin abstraction layer untuk generate image dan video melalui banyak provider yang mendukung API OpenAI-compatible.

Desain akhir mengikuti keputusan berikut:

- MCP hanya untuk generation workflow, bukan media management platform
- deployment local-only di device user
- konfigurasi provider hanya dari MCP settings
- hanya model yang mendukung image/video yang ditampilkan
- tidak ada storage permanen internal untuk hasil
- image tidak lagi dikembalikan sebagai base64 ke context karena membuat context bloating
- `output.directory` wajib diisi untuk image dan video
- hasil final selalu ditulis ke folder yang dipilih user
- rekomendasi folder output: gunakan folder di dalam workspace yang sedang dibuka agar mudah ditemukan

---

## 1. Tujuan Sistem

### Tujuan utama

Membangun MCP server lokal yang menyediakan tool seragam untuk:

- text to image
- image editing
- image variation
- text to video
- image to video
- polling status job async
- discovery model vision dari banyak provider OpenAI-compatible

### Bukan tujuan sistem

Sistem ini tidak ditujukan untuk:

- menyimpan history permanen
- menjadi DAM atau gallery
- menyimpan arsip output internal
- menjadi dashboard media library
- melakukan billing platform internal

---

## 2. Prinsip Desain

1. Thin gateway, bukan platform penyimpanan
2. Local-first, berjalan hanya di device user
3. Provider config hanya berasal dari MCP settings
4. Capability-driven, bukan model-name-driven saja
5. Response harus dinormalisasi agar semua provider terasa seragam
6. Hanya expose model vision yang relevan
7. `output.directory` wajib diisi oleh user
8. Temporary file boleh ada seperlunya, tetapi bukan storage permanen
9. Jangan pernah mengembalikan base64 image besar ke context chat
10. Hasil akhir harus selalu punya `final_path` yang jelas untuk image/video, atau `download_url` pada status video yang belum diunduh
11. Rekomendasikan folder output di dalam workspace aktif agar file mudah dicari

---

## 3. Konsep MCP untuk Use Case Ini

MCP berfungsi sebagai abstraction layer di atas beberapa provider image/video generation.

Tanpa MCP, client harus memahami:

- endpoint per provider
- perbedaan payload
- perbedaan format response
- perbedaan mode sync vs async
- model mana support image, edit, video, variation, atau tidak

Dengan MCP, client cukup memanggil tool seperti:

- [`list_models`](src/tools/list-models.ts:1)
- [`get_model_capabilities`](src/tools/get-model-capabilities.ts:1)
- [`generate_image`](src/tools/generate-image.ts:1)
- [`edit_image`](src/tools/edit-image.ts:1)
- [`create_image_variation`](src/tools/create-image-variation.ts:1)
- [`generate_video`](src/tools/generate-video.ts:1)
- [`animate_image`](src/tools/animate-image.ts:1)
- [`get_job_status`](src/tools/get-job-status.ts:1)

Lalu MCP menangani:

- discovery model provider
- filtering model vision-only
- capability validation
- prompt transformation
- payload transformation
- submit request ke provider
- polling status untuk job async
- response normalization
- write output ke folder user yang eksplisit

---

## 4. Arsitektur End-to-End

### Diagram arsitektur teks

```text
+----------------------+ 
| MCP Client / Agent   |
| Claude / local app   |
+----------+-----------+
           |
           | MCP tools
           v
+------------------------------+
| Local MCP Server             |
|------------------------------|
| Tool Router                  |
| Request Validator            |
| Model Discovery              |
| Vision Capability Filter     |
| Prompt Transformer           |
| Provider Router              |
| Response Normalizer          |
| File Publisher               |
+-----------+------------------+
            |
            v
+------------------------------+
| OpenAI-compatible Adapters   |
|------------------------------|
| auth injection               |
| endpoint mapping             |
| payload mapping              |
| async polling                |
+-----------+------------------+
            |
            v
+------------------------------+
| External Providers           |
| image/video APIs             |
+------------------------------+
```

### Komponen utama

#### Client
Bisa berupa MCP-capable desktop client atau agent lokal.

#### MCP server lokal
Menyediakan kontrak tool yang stabil.

#### Provider adapters
Menerjemahkan request unified ke format provider.

#### Model discovery dan filter
Mengambil daftar model provider dan hanya menampilkan model vision.

#### File publisher
Menulis hasil ke folder user yang diberikan lewat `output.directory`.

---

## 5. Konfigurasi Provider dari MCP Settings

### Sumber konfigurasi

Semua URL dan API key hanya berasal dari MCP settings, bukan dari file `.env` proyek.

### Bentuk config yang direkomendasikan

Untuk versi final yang Anda pilih, konfigurasi MCP dibuat sesederhana mungkin: cukup satu provider aktif dengan field utama dari MCP settings.

Contoh konsep:

```json
{
  "env": {
    "PROVIDER_BASE_URL": "https://api.provider-a.com/v1",
    "PROVIDER_API_KEY": "sk-xxx"
  }
}
```

### Shape config runtime

```json
{
  "baseUrl": "https://api.provider-a.com/v1",
  "apiKey": "sk-xxx"
}
```

### Catatan keamanan

- API key hanya dibaca saat startup MCP
- jangan log API key penuh
- header authorization harus di-redact jika logging aktif

---

## 6. Discovery dan Filtering Model

### Tujuan

Hanya model yang support image/video yang dimunculkan. Model text-only tidak boleh tampil.

### Strategi

Untuk versi final yang Anda minta, discovery dilakukan otomatis dari provider dengan pola berikut:

1. MCP membaca `baseUrl` dan `apiKey` dari MCP settings
2. MCP memanggil endpoint [`GET /models`](src/providers/endpoints.ts:1)
3. MCP membaca daftar model yang tersedia
4. MCP menginfer apakah model termasuk image/video
5. MCP memfilter keluar model yang tidak relevan
6. hanya model vision yang dimasukkan ke registry aktif

Tidak ada daftar model statis pada MVP ini.

### Sumber inferensi capability

- metadata dari response [`GET /models`](src/providers/endpoints.ts:1) bila tersedia
- endpoint support mapping bila provider memberi petunjuk capability
- naming heuristic seperti `image`, `vision`, `video`, `img`
- fallback rule internal bila metadata provider minim

---

## 7. Capability Schema

### Tujuan schema

Capability schema dipakai untuk:

- validasi operation per model
- validasi parameter yang didukung
- memberi client metadata yang konsisten

### Contoh schema capability

```json
{
  "provider": "providerA",
  "model": "image-ultra-v1",
  "family": "image",
  "operations": {
    "image_generation": true,
    "image_editing": true,
    "image_variation": false,
    "text_to_video": false,
    "image_to_video": false
  }
}
```

---

## 8. Desain Output Handling

### Aturan utama terbaru

#### `output.directory` wajib
- semua tool generation/edit yang menghasilkan file harus menerima `output.directory`
- MCP tidak lagi punya fallback ke base64 maupun default output directory otomatis
- hasil selalu disimpan ke folder yang dipilih user

#### Rekomendasi folder
Gunakan folder di dalam workspace yang sedang dibuka, misalnya:

- [`outputs/`](outputs/)
- [`generated/`](generated/)
- [`artifacts/`](artifacts/)

Contoh path yang direkomendasikan untuk workspace ini:

- `d:/All_project/own/AI_Coder/Native Tools/vision-generator/outputs`

### Shape request output

```json
{
  "output": {
    "directory": "d:/All_project/own/AI_Coder/Native Tools/vision-generator/outputs",
    "filename_prefix": "cybercat",
    "overwrite": false,
    "create_directory": true
  }
}
```

### Kenapa wajib

- user selalu tahu hasil ada di mana
- tidak ada kebingungan folder default tersembunyi
- tidak ada context bloating dari base64
- lebih cocok untuk workflow file-based nyata

---

## 9. Contoh Flow Penggunaan

### A. Generate image dari text prompt

```text
Client
  -> generate_image dengan output.directory
MCP
  -> validate request
  -> validate capability model
  -> transform prompt/payload
  -> submit ke provider
  -> terima hasil image
  -> simpan image ke output.directory
  -> return final_path ke client
```

### B. Edit image dengan mask

```text
Client
  -> edit_image dengan path input + path mask + output.directory
MCP
  -> baca file lokal
  -> validate capability model
  -> kirim multipart atau base64 sesuai provider
  -> terima hasil image
  -> simpan ke folder output user
  -> return final_path
```

### C. Generate video dari prompt

```text
Client
  -> generate_video dengan output.directory
MCP
  -> validate request
  -> submit ke provider
  -> provider return job id
  -> MCP return job_id dan status awal
```

### D. Polling status video sampai selesai

```text
Client
  -> get_job_status(job_id)
MCP
  -> poll provider
  -> jika selesai:
      - unduh hasil
      - simpan file ke output.directory
  -> normalize result
  -> return final_path
```

---

## 10. Contoh Request dan Response

### Generate image request

```json
{
  "model": "image-ultra-v1",
  "prompt": "A cinematic portrait of a cyberpunk cat in neon rain",
  "negative_prompt": "blurry, distorted, extra limbs",
  "aspect_ratio": "1:1",
  "resolution": "1024x1024",
  "seed": 42,
  "style": "cinematic",
  "safety_level": "medium",
  "output": {
    "directory": "d:/All_project/own/AI_Coder/Native Tools/vision-generator/outputs",
    "filename_prefix": "cyberpunk-cat",
    "create_directory": true
  }
}
```

### Generate image response

```json
{
  "status": "succeeded",
  "provider": "providerA",
  "model": "image-ultra-v1",
  "operation": "image_generation",
  "outputs": [
    {
      "type": "image",
      "mime_type": "image/png",
      "final_path": "d:/All_project/own/AI_Coder/Native Tools/vision-generator/outputs/cyberpunk-cat_2026-05-19T01-00-00-000Z.png",
      "width": 1024,
      "height": 1024
    }
  ]
}
```

### Generate video final response

```json
{
  "status": "succeeded",
  "provider": "providerB",
  "model": "video-gen-x",
  "operation": "text_to_video",
  "outputs": [
    {
      "type": "video",
      "mime_type": "video/mp4",
      "final_path": "d:/All_project/own/AI_Coder/Native Tools/vision-generator/outputs/future-city_2026-05-19T01-01-00-000Z.mp4",
      "width": 1280,
      "height": 720,
      "duration_seconds": 5,
      "fps": 24
    }
  ]
}
```

---

## 11. Struktur Project yang Direkomendasikan

```text
vision-mcp/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts
│  ├─ config/
│  │  └─ providers.ts
│  ├─ types/
│  │  ├─ capabilities.ts
│  │  ├─ requests.ts
│  │  ├─ responses.ts
│  │  └─ provider.ts
│  ├─ tools/
│  │  ├─ list-models.ts
│  │  ├─ get-model-capabilities.ts
│  │  ├─ generate-image.ts
│  │  ├─ edit-image.ts
│  │  ├─ create-image-variation.ts
│  │  ├─ generate-video.ts
│  │  ├─ animate-image.ts
│  │  └─ get-job-status.ts
│  ├─ core/
│  │  ├─ model-discovery.ts
│  │  ├─ capability-filter.ts
│  │  ├─ provider-router.ts
│  │  ├─ prompt-transformer.ts
│  │  ├─ response-normalizer.ts
│  │  ├─ file-output-publisher.ts
│  │  └─ errors.ts
│  ├─ providers/
│  │  ├─ base-provider.ts
│  │  ├─ openai-compatible.adapter.ts
│  │  ├─ provider-factory.ts
│  │  └─ quirks.ts
│  ├─ validation/
│  │  ├─ common.ts
│  │  ├─ image.ts
│  │  ├─ video.ts
│  │  └─ output.ts
│  └─ utils/
│     ├─ base64.ts
│     ├─ mime.ts
│     ├─ path.ts
│     └─ http.ts
└─ outputs/
```

---

## 12. Roadmap Implementasi

### Phase 1: MVP inti

- setup MCP server lokal stdio
- parse provider config dari MCP settings
- implement adapter OpenAI-compatible
- implement discovery model
- implement filter model vision-only
- implement `list_models`
- implement `get_model_capabilities`
- implement `generate_image`
- wajibkan `output.directory`

### Phase 2: Video dan polling

- implement `generate_video`
- implement `get_job_status`
- dukung video async
- unduh hasil video ke `output.directory`

### Phase 3: File-based workflows

- implement `edit_image`
- implement `create_image_variation`
- implement `animate_image`
- implement file publisher
- validasi output folder

### Phase 4: Hardening

- provider quirk profiles
- error mapping lebih rapi
- retry policy ringan
- logging yang lebih terstruktur
- optional local moderation guard

---

## 13. Keputusan Final

Arsitektur final yang direkomendasikan:

- MCP lokal stdio
- multi-provider OpenAI-compatible
- provider config hanya dari MCP settings
- model di-discover saat runtime
- hanya model image/video yang ditampilkan
- tanpa storage dan database permanen untuk MVP
- `output.directory` wajib diisi
- hasil image/video selalu ditulis ke folder pilihan user
- rekomendasi default workflow: gunakan folder di dalam workspace aktif seperti [`outputs/`](outputs/)

Desain ini paling sesuai dengan use case MCP generator lokal yang ringan, modular, tidak membuat context bloat, dan hasil filenya selalu jelas lokasinya.
