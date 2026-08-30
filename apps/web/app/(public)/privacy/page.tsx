import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/public/page-hero';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import {
  buildPublicSocialMetadata,
  PRIVACY_PAGE_DESCRIPTION,
  PRIVACY_PAGE_TITLE,
} from '@/lib/public/seo';

export const metadata: Metadata = {
  title: PRIVACY_PAGE_TITLE,
  description: PRIVACY_PAGE_DESCRIPTION,
  alternates: { canonical: '/privacy' },
  ...buildPublicSocialMetadata({
    title: `${PRIVACY_PAGE_TITLE} | ${BRAND_NAME_AR}`,
    description: PRIVACY_PAGE_DESCRIPTION,
    url: '/privacy',
  }),
};

const sectionClassName =
  'min-w-0 rounded-[var(--wanas-radius-panel)] border border-wanas-border bg-wanas-surface p-5 shadow-[var(--wanas-shadow-panel)] sm:p-7';
const headingClassName = 'text-xl font-extrabold text-wanas-text-primary sm:text-2xl';
const bodyClassName = 'mt-3 space-y-3 text-sm leading-8 text-wanas-text-secondary sm:text-base';
const listClassName =
  'mt-3 list-disc space-y-2 ps-5 text-sm leading-8 text-wanas-text-secondary sm:text-base';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHero
        title="سياسة الخصوصية"
        description="توضح هذه السياسة البيانات التي تحتاجها وناستنا لتشغيل الخدمة الحالية وكيف نتعامل معها."
        variant="compact"
        className="mb-8 sm:mb-10"
      >
        <p className="text-wanas-text-muted text-xs sm:text-sm">آخر تحديث: 30 أغسطس 2026</p>
      </PageHero>

      <article className="mx-auto min-w-0 max-w-4xl space-y-5 sm:space-y-6">
        <section className={sectionClassName}>
          <h2 className={headingClassName}>نطاق السياسة</h2>
          <div className={bodyClassName}>
            <p>
              وناستنا منصة ألعاب جماعية تعمل من المتصفح. يمكنك دخول الغرف واللعب كضيف دون إنشاء
              حساب، وقد ترتبط بعض المشاركات بحساب مسجل إذا كنت تستخدم حسابًا متاحًا لك.
            </p>
            <p>
              تغطي هذه السياسة الموقع العام، والغرف، والألعاب، والمحادثة داخل الغرفة، والحسابات
              المسجلة والإدارية، والبيانات التشغيلية المرتبطة بها.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>بيانات الغرف واللاعبين المؤقتة</h2>
          <p className={`${bodyClassName} block`}>
            ننشئ ونعالج بيانات لازمة لتشغيل الغرفة والمحافظة على حالتها بين المشاركين، وتشمل:
          </p>
          <ul className={listClassName}>
            <li>معرّف الغرفة ورمزها وحالتها وإعدادات اللعبة وسعة الغرفة وحالة القفل.</li>
            <li>
              اسم العرض الذي تختاره، ومعرّف اللاعب، وحالة الاتصال أو المغادرة، وما إذا كنت لاعبًا أو
              متفرجًا، وأوقات الانضمام وآخر ظهور.
            </li>
            <li>
              رسائل محادثة الغرفة، واسم المرسل الظاهر وقت الإرسال، ووقت الرسالة، لكي تظهر للمشاركين
              داخل الغرفة.
            </li>
            <li>
              مدخلات اللعب الحية مثل الإجابات والرسومات وحالة الجولة بالقدر اللازم لتشغيل المباراة
              وعرضها للمشاركين.
            </li>
          </ul>
          <p className={`${bodyClassName} block`}>
            تبقى حالة اللعبة الحية في ذاكرة الخادم ولا تتحول إلى سجل دائم، باستثناء ملخص المباراة
            والنتائج الموضحة أدناه.
          </p>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>بيانات العودة إلى الغرفة</h2>
          <div className={bodyClassName}>
            <p>
              تصدر الخدمة رمزًا عشوائيًا للعودة إلى مقعد اللاعب بعد انقطاع الاتصال أو تحديث الصفحة.
              يحفظ المتصفح الرمز نفسه عند الحاجة للعودة، بينما يحفظ الخادم قيمة مجزأة منه للتحقق من
              الطلب دون حفظ الرمز المقروء في قاعدة البيانات.
            </p>
            <p>
              ترتبط بيانات العودة بمعرّفات الغرفة واللاعب ورمز الغرفة واسم العرض حتى لا يُستخدم رمز
              لغرفة أو لاعب مختلف.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>سجل المباريات والنتائج</h2>
          <div className={bodyClassName}>
            <p>
              تحتفظ وناستنا بسجل مباريات محفوظ في قاعدة البيانات يشمل اللعبة، ورمز الغرفة، وحالة
              المباراة، ووقت البدء والانتهاء عند توفره، والمشاركين بأسماء العرض، والنتائج مثل النقاط
              والترتيب والفريق والفائز بحسب اللعبة.
            </p>
            <p>
              قد يرتبط سجل مشاركة اللاعب بحسابه المسجل إن كان اللاعب قد دخل بحساب. يبقى سجل المباراة
              بعد حذف الغرفة حتى يمكن عرض التاريخ والإحصاءات التشغيلية.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>أحداث المنتج والتحليلات الداخلية</h2>
          <div className={bodyClassName}>
            <p>
              تسجل وناستنا أحداث استخدام داخلية باسم <bdi dir="ltr">ProductEvents</bdi> لفهم تشغيل
              المنتج، مثل إنشاء غرفة أو دخولها، ودخول متفرج، ونجاح العودة، وإغلاق الغرفة.
            </p>
            <p>
              تتضمن هذه الأحداث نوع الحدث ووقته، وقد تتضمن معرّف الغرفة الداخلي وسعتها أو عدد
              اللاعبين. لا تتضمن أسماء اللاعبين أو رسائل المحادثة أو البريد الإلكتروني أو رمز الغرفة
              القابل للمشاركة.
            </p>
            <p>
              لا تستخدم وناستنا حاليًا حزمة إعلانات، أو بكسل تتبع، أو خدمة تحليلات خارجية تابعة لطرف
              ثالث.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>بيانات الحسابات والجلسات</h2>
          <ul className={listClassName}>
            <li>
              للحسابات المسجلة والإدارية: البريد الإلكتروني، واسم العرض المفضل، والدور، وتواريخ
              إنشاء الحساب وتحديثه.
            </li>
            <li>
              تُحفظ كلمة المرور في صورة مجزأة وليست كنص مقروء، وتُحفظ جلسة الدخول في الخادم باستخدام
              رمز مجزأ وتاريخ انتهاء.
            </li>
            <li>
              يستخدم المتصفح ملف تعريف ارتباط أساسيًا باسم <bdi dir="ltr">wanasatna_sid</bdi> لإبقاء
              جلسة الحساب. هذا الملف مخصص للمصادقة وليس للإعلانات أو التحليلات الخارجية.
            </li>
          </ul>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>التخزين داخل المتصفح</h2>
          <div className={bodyClassName}>
            <p>
              تستخدم وناستنا <bdi dir="ltr">sessionStorage</bdi> لحفظ جلسة الغرفة النشطة داخل علامة
              التبويب، بما في ذلك معرّفات الغرفة واللاعب، ورمز الغرفة، واسم العرض، ورمز العودة،
              واللعبة المحددة وبعض رسائل التنقل المؤقتة.
            </p>
            <p>
              تستخدم <bdi dir="ltr">localStorage</bdi> لحفظ بيانات العودة إلى الغرفة في المتصفح نفسه
              وتفضيل كتم أصوات اللعبة. قد يستمر هذا التخزين بعد إغلاق علامة التبويب إلى أن تزيله
              الخدمة عند المغادرة أو تنظيف الهوية ذات الصلة، أو تمسح بيانات المتصفح بنفسك.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>عنوان الشبكة والحماية من الإساءة</h2>
          <div className={bodyClassName}>
            <p>
              تعالج الخدمة عنوان بروتوكول الإنترنت (<bdi dir="ltr">IP</bdi>) في ذاكرة الخادم لتطبيق
              حدود الطلبات والحماية من الإساءة عند الاتصال، وإنشاء الغرف ودخولها، والعودة، وتسجيل
              الحساب أو الدخول إليه. لا يضيف التطبيق هذا العنوان إلى سجلات المباريات أو أحداث المنتج
              أو جداول الحسابات.
            </p>
            <p>
              قد تعالج بنية الاستضافة بيانات الطلب المعتادة، مثل عنوان بروتوكول الإنترنت ووقت الطلب،
              لأغراض التشغيل والأمان وفقًا لطريقة عمل مزود الاستضافة.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>كيف نستخدم البيانات</h2>
          <ul className={listClassName}>
            <li>إنشاء الغرف وربط اللاعبين ومزامنة اللعبة والمحادثة.</li>
            <li>إعادة اللاعب إلى مقعده بعد الانقطاع أو تحديث الصفحة.</li>
            <li>حفظ سجل المباريات والنتائج المرتبطة بها.</li>
            <li>تشغيل الحسابات والجلسات والصلاحيات الإدارية.</li>
            <li>منع الإساءة وحماية استقرار الخدمة وتشخيص الأعطال.</li>
            <li>فهم الاستخدام العام للخدمة من خلال التحليلات الداخلية المحدودة.</li>
          </ul>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>مزودو البنية والروابط الخارجية</h2>
          <ul className={listClassName}>
            <li>
              <bdi dir="ltr">Railway</bdi> لتشغيل واستضافة أجزاء الخدمة ومعالجة طلبات الشبكة
              اللازمة.
            </li>
            <li>
              <bdi dir="ltr">Neon</bdi> لتوفير بنية قاعدة البيانات التي تحفظ البيانات الدائمة
              والبيانات التشغيلية المذكورة في هذه السياسة.
            </li>
            <li>
              <bdi dir="ltr">Discord</bdi> هو رابط خارجي للمجتمع والتواصل. عند اختيار الرابط تنتقل
              إلى Discord وتخضع لسياساته.
            </li>
          </ul>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>التنظيف والاحتفاظ الحالي</h2>
          <ul className={listClassName}>
            <li>
              عند حذف الغرفة بعد انتهائها أو خلوها، تُحذف سجلات اللاعبين ورسائل المحادثة المرتبطة
              بها.
            </li>
            <li>
              تُنهى المباراة النشطة عند إغلاق الغرفة، لكن سجل المباراة والمشاركين والنتائج يبقى
              منفصلًا عن الغرفة المحذوفة.
            </li>
            <li>تنتهي حالة اللعب الموجودة في الذاكرة عند انتهاء الجلسة أو إعادة تشغيل الخادم.</li>
            <li>تُنظف جلسات الحساب المنتهية آليًا من قاعدة البيانات.</li>
            <li>
              لا يفرض النظام الحالي مدة حذف تلقائية ثابتة للحسابات أو سجلات المباريات أو أحداث
              المنتج.
            </li>
          </ul>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>الأمان والتحديثات والتواصل</h2>
          <div className={bodyClassName}>
            <p>
              تستخدم وناستنا تدابير تقنية مناسبة لطبيعة الخدمة، ومنها تجزئة كلمات المرور ورموز
              الجلسات ورموز العودة المحفوظة على الخادم، وتقييد الوصول الإداري. لا توجد وسيلة تقنية
              تضمن حماية مطلقة للبيانات.
            </p>
            <p>
              قد نحدّث هذه السياسة عندما يتغير المنتج أو أسلوب معالجة البيانات. ستكون النسخة
              المنشورة هنا هي النسخة الحالية.
            </p>
            <p>
              للاستفسارات المتعلقة بالخصوصية، استخدم صفحة{' '}
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
