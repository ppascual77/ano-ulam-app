-- price_source_url/price_source_label predate multi-source price grounding:
-- they held one source, then were kept as "first source's link + summary"
-- once price_sources (20261003010000) started holding every averaged
-- source. On a 2-source row that showed only one link, which read as data
-- loss. Nothing reads them, and every link they held is also in
-- price_sources, so price_sources is now the only place price links live.
alter table public.ingredients drop column price_source_url;
alter table public.ingredients drop column price_source_label;
