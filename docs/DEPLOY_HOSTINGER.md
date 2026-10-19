# Deploy BCare ขึ้น Hostinger VPS (Docker + GitHub Actions)

```text
git push (main) → CI (lint + typecheck + docker build)
               → Deploy: build image → GHCR (private: latest + sha-xxxxxxx)
               → SSH เข้า VPS: ~/bcare → docker compose pull + up -d → เช็ก /api/health
VPS: Nginx + HTTPS (certbot) u-chang-o.com → 127.0.0.1:3301 → container app → Supabase (cloud)
```

| ค่า | ของแอปนี้ | ของแอป Lab (ห้ามชน) |
|---|---|---|
| โฟลเดอร์บน VPS | `~/bcare` | `~/app` |
| Port | `127.0.0.1:3301` | `127.0.0.1:3300` |
| โดเมน | `u-chang-o.com`, `www.u-chang-o.com` | - |
| Image | `ghcr.io/aqson0710/bcare-garage-booking-system` | - |
| Health | `GET /api/health` → 200 / 503 | - |

ฐานข้อมูลคือ Supabase บนคลาวด์ ไม่มี container DB ไฟล์ SQL ใน `supabase/` ยังรันเองใน Supabase SQL Editor เหมือนเดิม

---

## 0. ทดสอบในเครื่อง (PowerShell + Docker Desktop)

```powershell
Copy-Item .env.example .env      # แล้วแก้ค่าใน .env เป็นค่าจริง (ไฟล์นี้ไม่เข้า git และไม่เข้า image)
docker compose up --build -d
docker compose ps                 # app ต้องขึ้น (healthy)
Invoke-WebRequest http://127.0.0.1:3301/api/health -UseBasicParsing | Select-Object StatusCode, Content
# เปิด http://localhost:3301
docker compose down               # ห้ามใส่ -v
```

## 1. Commit + push

```powershell
git add .
git commit -m "Add Docker + CI/CD for Hostinger VPS"
git push origin main
```

ดูที่แท็บ **Actions** ของ repo: `CI` ต้องเป็นสีเขียว ส่วน `Deploy` ครั้งแรกจะ fail ที่ขั้น "Check build variables" จนกว่าจะทำข้อ 2

## 2. GitHub → Settings → Secrets and variables → Actions

**แท็บ Variables** (เป็นค่า public อยู่แล้ว เพราะถูกฝังลงในเบราว์เซอร์):

| Name | ค่า |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key |

**แท็บ Secrets**:

| Name | ค่า |
|---|---|
| `VPS_HOST` | IP ของ VPS (ดูได้ใน hPanel → VPS) |
| `VPS_USER` | user ที่ SSH เข้าและรัน docker ได้ (ใช้ตัวเดียวกับ Lab) |
| `VPS_SSH_KEY` | private key ของ deploy key ตัวเดียวกับ Lab (ทั้งไฟล์ รวมบรรทัด BEGIN/END) |

`SUPABASE_SERVICE_ROLE_KEY` กับ `SLIPOK_*` **ห้ามใส่ใน GitHub** ให้อยู่ใน `.env` บน VPS เท่านั้น

## 3. DNS (hPanel → Domains → u-chang-o.com → DNS / Nameservers)

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `@` | IP ของ VPS | 300 |
| A (หรือ CNAME → `u-chang-o.com`) | `www` | IP ของ VPS | 300 |

ถ้ามี A record เก่าที่ชี้ไป Hostinger web hosting ให้ลบทิ้งก่อน เช็กว่าชี้ถูกแล้วด้วย `nslookup u-chang-o.com`
ใน hPanel → VPS → Firewall ต้องเปิด port 22, 80, 443

## 4. บน VPS: เตรียมโฟลเดอร์แอป

```powershell
# รันบนเครื่องคุณ (PowerShell) เพื่อ copy ไฟล์ขึ้น VPS
ssh <VPS_USER>@<VPS_IP> "mkdir -p ~/bcare"
scp docker-compose.yml deploy/make-env.sh deploy/nginx.conf <VPS_USER>@<VPS_IP>:~/bcare/
```

**ห้าม** copy `docker-compose.override.yml` ขึ้น VPS (ไฟล์นี้ใช้ build ในเครื่องเท่านั้น)

```bash
# รันบน VPS
ssh <VPS_USER>@<VPS_IP>
cd ~/bcare
bash make-env.sh                  # ถามค่าทีละตัว ตอนพิมพ์ key ลับจะไม่โชว์บนจอ แล้วสร้าง .env (chmod 600)
# ถ้าเคย login ghcr.io ไว้ตอนทำ Lab แล้ว ข้ามบรรทัดนี้ได้
echo <GH_TOKEN_read:packages> | docker login ghcr.io -u aqson0710 --password-stdin
```

ต้องให้ GitHub Actions push image ได้สำเร็จก่อน (ทำข้อ 2 แล้วกด Re-run Deploy) จากนั้นค่อยรัน:

```bash
docker compose pull && docker compose up -d
docker compose ps
curl -i http://127.0.0.1:3301/api/health
```

## 5. บน VPS (root): Nginx + HTTPS

```bash
sudo cp ~/bcare/nginx.conf /etc/nginx/sites-available/u-chang-o.com
sudo ln -s /etc/nginx/sites-available/u-chang-o.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d u-chang-o.com -d www.u-chang-o.com --redirect
```

## 6. Supabase → Authentication → URL Configuration

- **Site URL:** `https://u-chang-o.com`
- **Redirect URLs:** เพิ่ม `https://u-chang-o.com/**` และ `https://www.u-chang-o.com/**` (เก็บ `http://localhost:3000/**` ไว้สำหรับ dev)

ถ้าไม่ตั้งตรงนี้ ลิงก์ยืนยันอีเมลและลิงก์ reset password จะเด้งไปที่ localhost

## 7. Deploy อัตโนมัติ

GitHub → Actions → **Deploy** → **Run workflow** (หรือ push ขึ้น main ได้เลย) แล้วเปิด https://u-chang-o.com และ https://u-chang-o.com/api/health

### Rollback

แก้ `APP_IMAGE` ใน `~/bcare/.env` ให้เป็น tag เก่า เช่น `...:sha-08b669b` แล้วรัน `docker compose up -d`

### เปลี่ยน Supabase URL หรือ publishable key

ค่าสองตัวนี้ถูกฝังตอน build แก้ที่ GitHub Variables แล้วกด Run workflow Deploy ใหม่ (การแก้ใน `.env` บน VPS อย่างเดียวไม่มีผล)
