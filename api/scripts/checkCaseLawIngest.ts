import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AggregateRow = {
  category_name: string;
  total_docs: bigint | number;
  docs_with_content: bigint | number;
};

type MissingRow = {
  id: string;
  title: string;
};

const toNumber = (value: bigint | number): number => (typeof value === 'bigint' ? Number(value) : value);

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error('DATABASE_URL is missing (api/.env).');
    process.exit(1);
  }

  const aggregate = await prisma.$queryRaw<AggregateRow[]>`
    SELECT
      c.name AS category_name,
      COUNT(*) AS total_docs,
      COUNT(*) FILTER (WHERE COALESCE(d.content, '') <> '') AS docs_with_content
    FROM "Document" d
    JOIN "Category" c ON c.id = d."categoryId"
    WHERE c.name = 'פסיקה'
    GROUP BY c.name
  `;

  const row = aggregate[0];
  if (!row) {
    console.log('פסיקה: total_docs=0, docs_with_content=0');
    return;
  }

  const totalDocs = toNumber(row.total_docs);
  const docsWithContent = toNumber(row.docs_with_content);
  console.log(`פסיקה: total_docs=${totalDocs}, docs_with_content=${docsWithContent}`);

  if (docsWithContent < totalDocs) {
    const missing = await prisma.$queryRaw<MissingRow[]>`
      SELECT d.id, d.title
      FROM "Document" d
      JOIN "Category" c ON c.id = d."categoryId"
      WHERE c.name = 'פסיקה'
        AND COALESCE(d.content, '') = ''
      ORDER BY d."createdAt" DESC
      LIMIT 3
    `;

    for (const doc of missing) {
      console.log(`missing_content: id=${doc.id}, title=${doc.title}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
