import { randomBytes } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateArticleDto,
  QueryArticlesDto,
  UpdateArticleDto,
} from './dto/article.dto';

/** 列表不含內文（content_html 可達數十 KB） */
const ARTICLE_LIST_FIELDS =
  'id, slug, title, excerpt, cover_image_url, is_featured, status, published_at, created_at, updated_at';

const ARTICLE_AUTHOR_EMBED =
  'author:profiles!articles_author_id_fkey(id, display_name, full_name, avatar_url)';

/** Tiptap 編輯器輸出的白名單（意外貼上的 script / style / iframe 一律剝除） */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h2',
    'h3',
    'strong',
    'em',
    'u',
    's',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'br',
    'code',
    'pre',
    'figure',
    'figcaption',
  ],
  allowedAttributes: {
    a: ['href'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
};

@Injectable()
export class ArticlesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** 公開列表：僅已發佈，發佈時間新→舊；featured=true 供首頁精選區塊 */
  async findPublished(query: QueryArticlesDto) {
    const from = (query.page - 1) * query.pageSize;

    let builder = this.supabase.admin
      .from('articles')
      .select(ARTICLE_LIST_FIELDS, { count: 'exact' })
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, from + query.pageSize - 1);

    if (query.featured) builder = builder.eq('is_featured', true);

    const { data, error, count } = await builder;
    if (error) throw new InternalServerErrorException(error.message);

    return {
      items: data ?? [],
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 公開內頁：slug 取全文 + 作者名片 */
  async findBySlug(slug: string) {
    const { data, error } = await this.supabase.admin
      .from('articles')
      .select(`*, ${ARTICLE_AUTHOR_EMBED}`)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Article ${slug} not found`);
    return data;
  }

  /** 後台列表：作者自己的全部文章（含草稿），不含內文 */
  async findMine(authorId: string) {
    const { data, error } = await this.supabase.admin
      .from('articles')
      .select(ARTICLE_LIST_FIELDS)
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async create(authorId: string, dto: CreateArticleDto) {
    const status = dto.status ?? 'draft';
    const row = {
      author_id: authorId,
      title: dto.title.trim(),
      excerpt: dto.excerpt?.trim() || null,
      content_html: sanitizeHtml(dto.contentHtml, SANITIZE_OPTIONS),
      cover_image_url: dto.coverImageUrl?.trim() || null,
      is_featured: dto.isFeatured ?? false,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    };

    // slug 撞號（unique violation）補亂數尾碼重試一次
    let slug = dto.slug ?? this.slugFromTitle(dto.title);
    for (let attempt = 0; ; attempt += 1) {
      const { data, error } = await this.supabase.admin
        .from('articles')
        .insert({ ...row, slug })
        .select('*')
        .single();

      if (!error) return data;
      if (error.code === '23505' && attempt === 0) {
        slug = `${slug}-${randomBytes(3).toString('base64url').toLowerCase()}`;
        continue;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async update(authorId: string, id: string, dto: UpdateArticleDto) {
    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.excerpt !== undefined) patch.excerpt = dto.excerpt.trim() || null;
    if (dto.contentHtml !== undefined) {
      patch.content_html = sanitizeHtml(dto.contentHtml, SANITIZE_OPTIONS);
    }
    if (dto.coverImageUrl !== undefined) {
      patch.cover_image_url = dto.coverImageUrl.trim() || null;
    }
    if (dto.isFeatured !== undefined) patch.is_featured = dto.isFeatured;
    if (dto.status !== undefined) patch.status = dto.status;

    if (dto.status === 'published') {
      // 首次發佈才蓋時間戳；重新發佈保留原始發佈日（列表排序穩定）
      const { data: existing } = await this.supabase.admin
        .from('articles')
        .select('published_at')
        .eq('id', id)
        .eq('author_id', authorId)
        .maybeSingle();
      if (existing && !existing.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await this.supabase.admin
      .from('articles')
      .update(patch)
      .eq('id', id)
      .eq('author_id', authorId)
      .select('*')
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Article ${id} not found`);
    return data;
  }

  async remove(authorId: string, id: string) {
    const { data, error } = await this.supabase.admin
      .from('articles')
      .delete()
      .eq('id', id)
      .eq('author_id', authorId)
      .select('id')
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Article ${id} not found`);
    return { ok: true };
  }

  /** 標題轉 slug；非拉丁字元（中文標題）轉不出東西時退回亂數 */
  private slugFromTitle(title: string): string {
    const slug = title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
    return slug || randomBytes(6).toString('base64url').toLowerCase();
  }
}
