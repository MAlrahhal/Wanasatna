import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/public/page-hero';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { TERMS_PAGE_DESCRIPTION, TERMS_PAGE_TITLE } from '@/lib/public/seo';

export const metadata: Metadata = {
  title: TERMS_PAGE_TITLE,
  description: TERMS_PAGE_DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `${TERMS_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: TERMS_PAGE_DESCRIPTION,
    url: '/terms',
    locale: 'ar',
    siteName: BRAND_NAME_AR,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${TERMS_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: TERMS_PAGE_DESCRIPTION,
  },
};

const sectionClassName =
  'min-w-0 rounded-[var(--wanas-radius-panel)] border border-wanas-border bg-wanas-surface p-5 shadow-[var(--wanas-shadow-panel)] sm:p-7';
const headingClassName = 'text-xl font-extrabold text-wanas-text-primary sm:text-2xl';
const bodyClassName = 'mt-3 space-y-3 text-sm leading-8 text-wanas-text-secondary sm:text-base';
const listClassName =
  'mt-3 list-disc space-y-2 ps-5 text-sm leading-8 text-wanas-text-secondary sm:text-base';

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="الشروط والأحكام"
        description="قواعد مختصرة لاستخدام وناستنا والغرف والألعاب والتواصل بين المشاركين."
        variant="compact"
        className="mb-8 sm:mb-10"
      >
        <p className="text-wanas-text-muted text-xs sm:text-sm">آخر تحديث: 30 أغسطس 2026</p>
      </PageHero>

      <article className="mx-auto min-w-0 max-w-4xl space-y-5 sm:space-y-6">
        <section className={sectionClassName}>
          <h2 className={headingClassName}>قبول الشروط</h2>
          <div className={bodyClassName}>
            <p>
              باستخدام وناستنا أو إنشاء غرفة أو دخولها، فإنك توافق على هذه الشروط وسياسة الخصوصية.
              إذا لم توافق عليها، فلا تستخدم الخدمة.
            </p>
            <p>
              تنطبق الشروط على استخدام الموقع العام، والغرف، والألعاب، والمحادثة، وأي وظائف حساب أو
              إدارة متاحة لك داخل وناستنا.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>طبيعة وناستنا واستخدام الضيف</h2>
          <div className={bodyClassName}>
            <p>
              وناستنا منصة ألعاب اجتماعية وجماعية عبر المتصفح. يمكن للاعب الانضمام كضيف باستخدام اسم
              عرض ورمز غرفة دون الحاجة إلى إنشاء حساب للعب.
            </p>
            <p>
              رمز الغرفة مخصص للمشاركة مع الأشخاص الذين تريد دعوتهم. احرص على اختيار من تشاركه معه
              وعلى حماية جهازك وجلستك من الاستخدام غير المصرح به.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>أسماء اللاعبين والمحتوى الذي يقدمه المستخدم</h2>
          <div className={bodyClassName}>
            <p>
              قد ترسل داخل الغرفة اسم عرض، ورسائل محادثة، وإجابات، ورسومات، واختيارات أخرى تتطلبها
              اللعبة. يظهر هذا المحتوى للمشاركين بحسب قواعد الغرفة واللعبة.
            </p>
            <p>
              تظل مسؤولًا عن المحتوى الذي ترسله وعن امتلاكك الحق في استخدامه. تسمح لوناستنا بمعالجته
              بالقدر اللازم لتشغيل الغرفة واللعبة وعرض النتائج وحفظ البيانات الموضحة في سياسة
              الخصوصية.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>السلوك المقبول</h2>
          <p className={`${bodyClassName} block`}>عند استخدام وناستنا، يجب ألا:</p>
          <ul className={listClassName}>
            <li>تضايق الآخرين أو تهددهم أو تنشر خطاب كراهية أو محتوى غير قانوني أو مسيء.</li>
            <li>تنتحل شخصية شخص أو جهة أخرى أو تستخدم اسمًا مضللًا بقصد الإضرار.</li>
            <li>تكشف بيانات شخصية أو سرية تخص شخصًا آخر دون إذنه.</li>
            <li>تحاول الدخول إلى حساب أو غرفة أو صلاحية لا يحق لك الوصول إليها.</li>
            <li>تستغل ثغرات أو أدوات آلية أو طلبات مفرطة لتعطيل الخدمة أو إفساد اللعب.</li>
            <li>تتحايل على حدود الاستخدام أو إجراءات الحماية أو قرارات الإشراف.</li>
            <li>تستخدم الخدمة في الاحتيال أو أي نشاط مخالف للنظام.</li>
          </ul>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>صلاحيات مضيف الغرفة والإشراف</h2>
          <div className={bodyClassName}>
            <p>
              يستطيع مضيف الغرفة اختيار الألعاب والإعدادات، وبدء اللعب، وقفل الغرفة أو فتحها، وطرد
              لاعبين من الغرفة. هذه الأدوات مخصصة لتنظيم الجلسة ولا تمنح المضيف صلاحية الوصول إلى
              حسابات الآخرين أو بياناتهم الخاصة.
            </p>
            <p>
              قد تتخذ إدارة وناستنا إجراءات تشغيلية مثل تقييد الاستخدام أو إزالة لاعب أو إغلاق غرفة
              عند وجود إساءة أو خطر أمني أو مخالفة لهذه الشروط.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>الحسابات وأمان الوصول</h2>
          <div className={bodyClassName}>
            <p>
              إذا استخدمت حسابًا مسجلًا أو إداريًا، فأنت مسؤول عن صحة المعلومات التي تقدمها وعن
              حماية بيانات الدخول وجهازك. لا تشارك جلسة الدخول أو تحاول منح صلاحياتك لشخص غير مخول.
            </p>
            <p>
              أخبرنا عبر قناة التواصل المتاحة إذا اعتقدت أن حسابًا أو جلسة وصول تعرضت لاستخدام غير
              مصرح به.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>توفر الخدمة والتغييرات</h2>
          <div className={bodyClassName}>
            <p>
              تُقدّم وناستنا بحسب توفرها. قد تتوقف الخدمة مؤقتًا بسبب الصيانة أو الأعطال أو ظروف
              البنية التحتية، وقد تتغير الألعاب أو الإعدادات أو أجزاء الموقع لتحسين التشغيل أو
              الأمان.
            </p>
            <p>
              لا نضمن استمرار كل غرفة أو جلسة لعب أو ميزة دون انقطاع، ولا ينبغي الاعتماد على وناستنا
              كوسيلة وحيدة لحفظ محتوى مهم.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>الملكية الفكرية</h2>
          <div className={bodyClassName}>
            <p>
              حقوق اسم وناستنا وشعارها وتصميم الموقع وواجهاته ومحتواه الأصلي محفوظة لأصحاب الحقوق.
              لا يمنحك استخدام الخدمة حق نسخ أي منها أو إعادة نشره أو استغلاله تجاريًا دون إذن.
            </p>
            <p>
              لا تنتقل ملكية المحتوى الذي تقدمه أنت إلى وناستنا، مع بقاء السماح المحدود بمعالجته
              لتشغيل الخدمة كما هو موضح في هذه الشروط وسياسة الخصوصية.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>روابط Discord والمواقع الخارجية</h2>
          <div className={bodyClassName}>
            <p>
              توفر وناستنا رابطًا خارجيًا إلى مجتمعها على <bdi dir="ltr">Discord</bdi> للتواصل
              والدعم. عند فتح الرابط تغادر موقع وناستنا، وتخضع لاستخدام Discord وشروطه وسياساته، ولا
              تتحكم وناستنا في توفر تلك الخدمة الخارجية أو ممارساتها.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>حدود المسؤولية</h2>
          <div className={bodyClassName}>
            <p>
              تُقدّم الخدمة دون ضمان خلوها الكامل من الانقطاع أو الأخطاء أو فقدان حالة جلسة مؤقتة.
              ضمن الحدود التي يسمح بها النظام المطبق، لا تتحمل وناستنا مسؤولية الأضرار غير المباشرة
              الناتجة عن استخدام الخدمة أو تعذر استخدامها.
            </p>
            <p>لا تستبعد هذه الشروط أي مسؤولية لا يجوز استبعادها أو تقييدها نظامًا.</p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>تحديث الشروط والتواصل</h2>
          <div className={bodyClassName}>
            <p>
              قد نحدّث هذه الشروط عندما تتغير الخدمة أو متطلبات تشغيلها. ستكون النسخة المنشورة في
              هذه الصفحة هي النسخة الحالية، ويعني استمرار استخدامك بعد نشر التحديث قبول الشروط
              المحدثة.
            </p>
            <p>
              للاستفسارات، استخدم صفحة{' '}
              <Link
                href={PUBLIC_ROUTES.contact}
                className="text-wanas-accent hover:text-wanas-accent-hover font-bold underline underline-offset-4"
              >
                تواصل معنا
              </Link>
              .
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
