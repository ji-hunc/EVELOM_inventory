-- Supabase Storage 버킷 생성 및 정책 설정

-- 1. product-images 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- 2. 모든 사용자가 이미지를 업로드할 수 있도록 정책 설정
CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- 3. 모든 사용자가 이미지를 볼 수 있도록 정책 설정
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- 4. 인증된 사용자만 이미지를 삭제할 수 있도록 정책 설정
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- 5. 인증된 사용자만 이미지를 수정할 수 있도록 정책 설정
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');