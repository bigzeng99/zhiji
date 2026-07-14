-- 新增审核状态、上传者名、拒绝原因列
ALTER TABLE public.points ADD COLUMN review_status text NOT NULL DEFAULT 'approved'
  CHECK (review_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.points ADD COLUMN creator_name text NOT NULL DEFAULT '';
ALTER TABLE public.points ADD COLUMN reject_reason text NOT NULL DEFAULT '';

CREATE INDEX idx_points_review_status ON public.points(review_status);
CREATE INDEX idx_points_owner_created ON public.points(owner_id, created_at DESC);

-- 更新 RLS：owner 始终能看自己的；非 owner 只能看 approved 的
DROP POLICY "points_select" ON public.points;
CREATE POLICY "points_select" ON public.points
  FOR SELECT USING (
    status = 'active' AND (
      owner_id = auth.uid()
      OR (review_status = 'approved' AND (
        visibility = 'public'
        OR (visibility = 'team' AND team_id IN (
          SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        ))
      ))
    )
  );
