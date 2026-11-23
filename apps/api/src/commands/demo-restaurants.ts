export interface DemoCatalogCategory {
  title: string;
  linkAddons?: boolean;
  products: ReadonlyArray<{
    name: string;
    description: string;
    price: string;
  }>;
}

export interface DemoCatalogAddon {
  name: string;
  price: string;
}

export interface DemoCatalogOffer {
  title: string;
  description: string;
  initialPrice: string;
  realPrice: string;
  durationDays: number;
}

export interface DemoRestaurantFixture {
  slug: string;
  ownerName: string;
  title: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  opensAt: string;
  closesAt: string;
  categories: ReadonlyArray<DemoCatalogCategory>;
  addons: ReadonlyArray<DemoCatalogAddon>;
  offers: ReadonlyArray<DemoCatalogOffer>;
}

export const demoRestaurants: ReadonlyArray<DemoRestaurantFixture> = [
  {
    slug: 'farahat',
    ownerName: 'أحمد محمود عبدالعزيز',
    title: 'كبابجي فرحات الاصلي',
    description:
      'كباب وكفتة على الفحم، وحمام محشي بالفريك مع طحينة وسلطات بلدي.',
    address: 'شارع النصر، المعادي، القاهرة',
    latitude: '29.9753000',
    longitude: '31.2816000',
    opensAt: '11:00',
    closesAt: '01:00',
    categories: [
      {
        title: 'مشويات على الفحم',
        linkAddons: true,
        products: [
          {
            name: 'ربع كيلو كباب وكفتة مشكل',
            description:
              'مشويات كباب ضاني وكفتة بلدي على الفحم مع عيش ساخن وسلطة طحينة.',
            price: '235.00',
          },
          {
            name: 'نصف كيلو كفتة ضاني على الفحم',
            description:
              'كفتة ضاني متبلة ومشوية على الفحم تقدم مع بقدونس وطحينة ومخلل.',
            price: '360.00',
          },
          {
            name: 'نص فرخة شيش على الفحم',
            description: 'نصف دجاجة شيش متبلة على الفحم بتوابل فرحات الأصلية.',
            price: '195.00',
          },
          {
            name: 'ربع كيلو طرب ضاني على الفحم',
            description:
              'طرب ضاني بلدي مشوي على الفحم يقدم مع عيش بلدي ساخن وطحينة.',
            price: '245.00',
          },
        ],
      },
      {
        title: 'حمام وطواجن',
        linkAddons: true,
        products: [
          {
            name: 'فرد حمام محشي فريك بلدي',
            description: 'حمام بلدي محمر محشو بالفريك البلدي المتبل بالسمن.',
            price: '165.00',
          },
          {
            name: 'جوز حمام محشي أرز بالخلطة',
            description: 'جوز حمام محشي بالأرز بالكبد والقوانص والتوابل.',
            price: '310.00',
          },
          {
            name: 'طاجن عكاوي بالبصل',
            description: 'طاجن فخار عكاوي مطهو على نار هادئة مع البصل المكرمل.',
            price: '295.00',
          },
        ],
      },
      {
        title: 'ساندوتشات ومقبلات',
        linkAddons: true,
        products: [
          {
            name: 'ساندوتش كفتة بلدي',
            description: 'ساندوتش كفتة على الفحم بالطحينة والبقدونس.',
            price: '80.00',
          },
          {
            name: 'ساندوتش شيش طاووق',
            description: 'قطع شيش طاووق مشوي على الفحم مع ثومية ومخلل.',
            price: '85.00',
          },
          {
            name: 'سمبوسك لحمة وجبن (6 قطع)',
            description: '6 قطع سمبوسك مقرمشة محشوة لحمة مفرومة وميكس جبن.',
            price: '75.00',
          },
        ],
      },
      {
        title: 'المشروبات',
        linkAddons: false,
        products: [
          {
            name: 'عصير ليمون نعناع فريش',
            description: 'عصير ليمون طازج مضروب مع النعناع الأخضر والثلج.',
            price: '40.00',
          },
          {
            name: 'مياه معدنية كبيرة',
            description: 'زجاجة مياه معدنية باردة 1.5 لتر.',
            price: '20.00',
          },
        ],
      },
    ],
    addons: [
      { name: 'سلطة طحينة بلدي', price: '25.00' },
      { name: 'سلطة خضراء بلدي', price: '20.00' },
      { name: 'أرز بالخلطة والمكسرات', price: '45.00' },
      { name: 'عيش بلدي ساخن (3 أرغفة)', price: '15.00' },
      { name: 'مخلل بلدي مشكل', price: '15.00' },
      { name: 'بابا غنوج مشوي', price: '25.00' },
    ],
    offers: [
      {
        title: 'صينية فرحات العائلية على الفحم',
        description:
          'نصف كيلو كفتة ضاني + ربع كباب وكفتة + نص فرخة شيش على الفحم + طحينة وسلطات وعيش بلدي.',
        initialPrice: '830.00',
        realPrice: '689.00',
        durationDays: 35,
      },
      {
        title: 'عرض الحمام الملكي والطاجن',
        description:
          'جوز حمام محشي أرز بالخلطة مع طاجن عكاوي بالبصل و2 عصير ليمون نعناع فريش.',
        initialPrice: '685.00',
        realPrice: '569.00',
        durationDays: 25,
      },
      {
        title: 'وجبة الكبابجي الفردية المتكاملة',
        description:
          'ربع كيلو كباب وكفتة مشكل على الفحم + أرز بالخلطة + سلطة طحينة + عصير ليمون نعناع.',
        initialPrice: '345.00',
        realPrice: '279.00',
        durationDays: 30,
      },
      {
        title: 'عرض نص فرخة شيش على الفحم',
        description:
          'نص فرخة شيش متبلة على الفحم مع أرز بالخلطة وسلطة بلدي وطحينة وعيش ساخن.',
        initialPrice: '265.00',
        realPrice: '215.00',
        durationDays: 20,
      },
      {
        title: 'بوكس ساندوتشات الفحم للصحاب',
        description:
          '2 ساندوتش كفتة بلدي + 2 ساندوتش شيش طاووق + 2 عصير ليمون نعناع فريش.',
        initialPrice: '410.00',
        realPrice: '335.00',
        durationDays: 40,
      },
    ],
  },
  {
    slug: 'abou-tarek',
    ownerName: 'محمود طارق حسن',
    title: 'كشري ابوطارق',
    description:
      'كشري مصري بالأرز والعدس والمكرونة والحمص، مع بصل مقرمش ودقة وصلصة.',
    address: 'شارع معروف، وسط البلد، القاهرة',
    latitude: '30.0494000',
    longitude: '31.2386000',
    opensAt: '10:00',
    closesAt: '00:00',
    categories: [
      {
        title: 'أطباق الكشري',
        linkAddons: true,
        products: [
          {
            name: 'كشري وسط',
            description: 'كشري مصري أصلي بالصلصة والدقة والبصل المقرمش.',
            price: '55.00',
          },
          {
            name: 'كشري كبير',
            description: 'طبق كشري كبير غني بالعدس والحمص والبصل المقرمش.',
            price: '70.00',
          },
          {
            name: 'كشري إكسترا مخصوص',
            description: 'طبق كشري مخصوص بزيادة حمص وعدس وبصل مقرمش.',
            price: '85.00',
          },
          {
            name: 'كشري علبة فويل عائلي',
            description: 'علبة فويل عائلية تكفي 3–4 أفراد مع صلصة ودقة وشطة.',
            price: '175.00',
          },
        ],
      },
      {
        title: 'طواجن المكرونة',
        linkAddons: true,
        products: [
          {
            name: 'طاجن مكرونة باللحمة المفرومة',
            description: 'طاجن مكرونة فرن ساخن باللحمة المفرومة والصلصة.',
            price: '85.00',
          },
          {
            name: 'طاجن مكرونة بالفراخ',
            description: 'طاجن مكرونة فرن بقطع الفراخ المتبلة والصلصة.',
            price: '90.00',
          },
          {
            name: 'طاجن مكرونة بالكبدة الإسكندراني',
            description:
              'طاجن مكرونة فرن بالكبدة الإسكندراني المتبلة بالثوم والفلفل.',
            price: '95.00',
          },
        ],
      },
      {
        title: 'الحلويات والمشروبات',
        linkAddons: false,
        products: [
          {
            name: 'أرز بلبن فرن',
            description: 'طاجن أرز بلبن كريمي محمر في الفرن.',
            price: '35.00',
          },
          {
            name: 'مهلبية بالمكسرات',
            description: 'مهلبية كريمي باردة مزينة بالمكسرات وجوز الهند.',
            price: '30.00',
          },
          {
            name: 'عصير مانجو فريش',
            description: 'عصير مانجو طبيعي طازج.',
            price: '40.00',
          },
          {
            name: 'عصير برتقال طبيعي فريش',
            description: 'عصير برتقال بلدي معصور طازجاً ومثلج.',
            price: '35.00',
          },
          {
            name: 'بيبسي كانز',
            description: 'بيبسي كانز بارد 330 مل.',
            price: '25.00',
          },
        ],
      },
    ],
    addons: [
      { name: 'بصل مقرمش إكسترا', price: '15.00' },
      { name: 'حمص شام إكسترا', price: '15.00' },
      { name: 'صلصة طماطم مخصوص', price: '12.00' },
      { name: 'دقة ثوم وخل', price: '10.00' },
      { name: 'شطة زيت نارية', price: '10.00' },
      { name: 'توست محمص مقرمش', price: '18.00' },
    ],
    offers: [
      {
        title: 'عرض علبة العيلة الفويل + 4 أرز بلبن',
        description:
          'علبة كشري فويل عائلي تكفي 4 أفراد مع صلصة ودقة وشطة و4 أطباق أرز بلبن فرن.',
        initialPrice: '315.00',
        realPrice: '255.00',
        durationDays: 35,
      },
      {
        title: 'كومبو أبو طارق المخصوص',
        description:
          'طبق كشري إكسترا مخصوص بالعدس والحمص والبصل المقرمش مع عصير مانجو فريش وتوست محمص.',
        initialPrice: '145.00',
        realPrice: '115.00',
        durationDays: 25,
      },
      {
        title: 'ثنائي طواجن الفرن الساخنة',
        description:
          'طاجن مكرونة باللحمة المفرومة + طاجن مكرونة بالفراخ + 2 بيبسي كانز مثلج.',
        initialPrice: '225.00',
        realPrice: '179.00',
        durationDays: 30,
      },
      {
        title: 'عرض الغداء والتحلية لفردين',
        description:
          '2 طبق كشري كبير مع 2 مهلبية بالمكسرات ودقة ثوم وخل مخصوص.',
        initialPrice: '200.00',
        realPrice: '159.00',
        durationDays: 20,
      },
      {
        title: 'باقة التوفير الثلاثية',
        description: '3 أطباق كشري وسط طازة مع 3 بيبسي كانز وبصل مقرمش إضافي.',
        initialPrice: '240.00',
        realPrice: '189.00',
        durationDays: 40,
      },
    ],
  },
  {
    slug: 'sheikh-el-hara',
    ownerName: 'خالد إبراهيم منصور',
    title: 'حواوشي وفطير شيخ الحاره',
    description:
      'حواوشي بلدي وإسكندراني طازة من الفرن، وفطير مشلتت بحشوات حلوة وحادقة.',
    address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
    latitude: '30.0627000',
    longitude: '31.3371000',
    opensAt: '11:00',
    closesAt: '01:00',
    categories: [
      {
        title: 'حواوشي بلدي وإسكندراني',
        linkAddons: true,
        products: [
          {
            name: 'رغيف حواوشي لحمة بلدي',
            description: 'حواوشي بلدي متبل بالتوابل المصرية ومخبوز مقرمش.',
            price: '80.00',
          },
          {
            name: 'رغيف حواوشي إسكندراني بالسجق',
            description: 'حواوشي عجين إسكندراني محشو بالسجق البلدي والفلفل.',
            price: '105.00',
          },
          {
            name: 'حواوشي مخصوص ميكس جبن',
            description: 'حواوشي لحمة بلدي مغطى بميكس موتزاريلا وشيدر.',
            price: '110.00',
          },
          {
            name: 'حواوشي بسطرمة وجبنة كيري',
            description: 'رغيف حواوشي مقرمش باللحمة والبسطرمة وجبنة كيري.',
            price: '115.00',
          },
        ],
      },
      {
        title: 'فطير حادق',
        linkAddons: true,
        products: [
          {
            name: 'فطير مشلتت بلدي سادة',
            description: 'فطير مشلتت فلاحي مورّق بالسمن البلدي.',
            price: '115.00',
          },
          {
            name: 'فطير حادق سجق وجبن',
            description: 'فطير شرقي محشو سجق بلدي وميكس جبن وزيتون.',
            price: '155.00',
          },
          {
            name: 'فطير حادق فراخ مشوية ورانش',
            description: 'فطير محشو فراخ مشوية وموتزاريلا وصوص رانش.',
            price: '165.00',
          },
          {
            name: 'فطير حادق ميكس لحوم وجبن',
            description: 'فطير شرقي مورّق محشو سجق وبسطرمة ولحمة وجبن.',
            price: '185.00',
          },
        ],
      },
      {
        title: 'فطير حلو',
        linkAddons: true,
        products: [
          {
            name: 'فطير حلو كاسترد وسكر',
            description: 'فطير حلو محشو كاسترد كريمي ومرشوش بالسكر البودرة.',
            price: '95.00',
          },
          {
            name: 'فطير حلو نوتيلا وبندق',
            description: 'فطير حلو محشو نوتيلا وبندق محمص.',
            price: '130.00',
          },
        ],
      },
      {
        title: 'المشروبات',
        linkAddons: false,
        products: [
          {
            name: 'عصير قصب فريش',
            description: 'عصير قصب مصري طازج ومثلج.',
            price: '25.00',
          },
          {
            name: 'شاي بالنعناع',
            description: 'شاي مصري ساخن بأوراق النعناع الطازج.',
            price: '20.00',
          },
        ],
      },
    ],
    addons: [
      { name: 'ميكس جبن موتزاريلا وشيدر', price: '25.00' },
      { name: 'مخلل لفت وخيار بلدي', price: '15.00' },
      { name: 'سلطة طحينة بلدي', price: '20.00' },
      { name: 'عسل أسود وطحينة', price: '25.00' },
      { name: 'قشطة بلدي طازجة', price: '30.00' },
      { name: 'صوص شيدر حار', price: '20.00' },
    ],
    offers: [
      {
        title: 'لمة شيخ الحارة العائلية',
        description:
          '4 أرغفة حواوشي لحمة بلدي مقرمش + فطير حادق سجق وجبن + طحينة ومخلل + 2 عصير قصب فريش.',
        initialPrice: '525.00',
        realPrice: '419.00',
        durationDays: 35,
      },
      {
        title: 'عرض الفطير الحادق والحلو',
        description:
          'فطير حادق فراخ مشوية ورانش + فطير حلو نوتيلا وبندق + 2 شاي بالنعناع.',
        initialPrice: '335.00',
        realPrice: '269.00',
        durationDays: 25,
      },
      {
        title: 'فطار المشلتت الفلاحي الأصلي',
        description:
          '2 فطير مشلتت بلدي ساخن بالسمن البلدي مع عسل أسود وطحينة وقشطة بلدي و2 شاي بالنعناع.',
        initialPrice: '325.00',
        realPrice: '259.00',
        durationDays: 30,
      },
      {
        title: 'بوكس الحواوشي الإسكندراني',
        description:
          '2 رغيف حواوشي إسكندراني بالسجق + 1 حواوشي مخصوص ميكس جبن + طحينة ومخلل بلدي.',
        initialPrice: '355.00',
        realPrice: '285.00',
        durationDays: 20,
      },
      {
        title: 'عرض تحلية شيخ الحارة',
        description:
          'فطير حلو نوتيلا وبندق + فطير حلو كاسترد وسكر بودرة + 2 شاي بالنعناع.',
        initialPrice: '265.00',
        realPrice: '215.00',
        durationDays: 40,
      },
    ],
  },
  {
    slug: 'karam-el-sham',
    ownerName: 'عمر محمد الشامي',
    title: 'شاورما كرم الشام الاصلي',
    description:
      'شاورما فراخ ولحمة بتتبيلة شامية، في ساندوتشات أو وجبات عربي مع تومية ومخلل.',
    address: 'شارع مصدق، الدقي، الجيزة',
    latitude: '30.0389000',
    longitude: '31.2110000',
    opensAt: '11:00',
    closesAt: '02:00',
    categories: [
      {
        title: 'ساندوتشات الشاورما',
        linkAddons: true,
        products: [
          {
            name: 'ساندوتش شاورما فراخ سوري',
            description: 'شاورما فراخ في خبز صاج محمص مع ثومية ومخلل خيار.',
            price: '75.00',
          },
          {
            name: 'ساندوتش شاورما لحمة سوري',
            description: 'شاورما لحمة شامية مع طحينة وبصل وبقدونس.',
            price: '90.00',
          },
          {
            name: 'ساندوتش شاورما فراخ إكسترا جبنة',
            description: 'شاورما فراخ سوري بزيادة جبنة موتزاريلا سايحة.',
            price: '95.00',
          },
          {
            name: 'شاورما ماريا بالجبنة الموتزاريلا',
            description:
              'خبز سوري مقرمش محشو شاورما فراخ وجبنة موتزاريلا ومخلل.',
            price: '115.00',
          },
        ],
      },
      {
        title: 'وجبات الشاورما العربي',
        linkAddons: true,
        products: [
          {
            name: 'وجبة شاورما فراخ عربي',
            description: 'شاورما فراخ مقطعة مع بطاطس محمرة وثومية ومخلل.',
            price: '145.00',
          },
          {
            name: 'وجبة شاورما ميكس عربي',
            description: 'شاورما فراخ ولحمة عربي مع بطاطس وثومية وطحينة.',
            price: '175.00',
          },
        ],
      },
      {
        title: 'فتة شاورما',
        linkAddons: true,
        products: [
          {
            name: 'فتة شاورما فراخ بالثومية',
            description: 'أرز بسمتي وعيش محمص وشاورما فراخ وصوص ثومية شامي.',
            price: '130.00',
          },
          {
            name: 'فتة شاورما لحمة بالطحينة',
            description: 'أرز بسمتي وعيش محمص وشاورما لحمة وصوص طحينة.',
            price: '155.00',
          },
        ],
      },
      {
        title: 'مقبلات ومشروبات',
        linkAddons: false,
        products: [
          {
            name: 'بطاطس سوري بالثومية',
            description: 'بطاطس مقرمشة مع صوص ثومية شامي.',
            price: '55.00',
          },
          {
            name: 'سمبوسك شامي مشكل (6 قطع)',
            description: '6 قطع سمبوسك شامي مقرمشة بالجبنة واللحمة.',
            price: '65.00',
          },
          {
            name: 'عصير برتقال طبيعي',
            description: 'عصير برتقال فريش مثلج.',
            price: '40.00',
          },
          {
            name: 'سبرايت كانز',
            description: 'سبرايت كانز مثلج 330 مل.',
            price: '25.00',
          },
        ],
      },
    ],
    addons: [
      { name: 'صوص ثومية شامي إكسترا', price: '15.00' },
      { name: 'خيار مخلل شامي', price: '12.00' },
      { name: 'جبنة موتزاريلا سايحة', price: '25.00' },
      { name: 'صوص دبس رمان', price: '15.00' },
      { name: 'بطاطس محمرة صغير', price: '35.00' },
      { name: 'خبز سوري محمص إضافي', price: '15.00' },
    ],
    offers: [
      {
        title: 'بوكس كرم الشام للصحاب',
        description:
          '2 وجبة شاورما ميكس عربي + 2 ساندوتش شاورما فراخ سوري + بطاطس بالثومية + 2 سبرايت.',
        initialPrice: '595.00',
        realPrice: '479.00',
        durationDays: 35,
      },
      {
        title: 'عرض فتة الشاورما الثنائي',
        description:
          'فتة شاورما فراخ بالثومية + فتة شاورما لحمة بالطحينة + 2 عصير برتقال طبيعي فريش.',
        initialPrice: '365.00',
        realPrice: '295.00',
        durationDays: 25,
      },
      {
        title: 'تريو الساندوتش السوري',
        description:
          '2 ساندوتش شاورما فراخ سوري + 1 ساندوتش شاورما لحمة سوري + بطاطس سوري بالثومية.',
        initialPrice: '295.00',
        realPrice: '239.00',
        durationDays: 30,
      },
      {
        title: 'وجبة الشاورما العربي الموفرة',
        description:
          'وجبة شاورما فراخ عربي مقطعة مع بطاطس محمرة وثومية شامي ومخلل وسبرايت كانز.',
        initialPrice: '185.00',
        realPrice: '149.00',
        durationDays: 20,
      },
      {
        title: 'عرض الماريا والجبنة الشامي',
        description:
          '2 شاورما ماريا بالجبنة الموتزاريلا السايحة + 6 قطع سمبوسك شامي + 2 سبرايت كانز.',
        initialPrice: '345.00',
        realPrice: '279.00',
        durationDays: 40,
      },
    ],
  },
  {
    slug: 'buffalo-masr',
    ownerName: 'يوسف مصطفى عادل',
    title: 'برجر بافلو مصر',
    description:
      'برجر لحم مشوي بصوص مدخن وجبنة شيدر، مع ساندوتشات فرايد تشيكن وبطاطس.',
    address: 'شارع التسعين الشمالي، التجمع الخامس، القاهرة الجديدة',
    latitude: '30.0301000',
    longitude: '31.4735000',
    opensAt: '12:00',
    closesAt: '02:00',
    categories: [
      {
        title: 'برجر لحم مشوي',
        linkAddons: true,
        products: [
          {
            name: 'كلاسيك بافلو برجر',
            description:
              'برجر لحم بقري مشوي على اللهب مع شيدر وخس وطماطم وصوص بافلو.',
            price: '145.00',
          },
          {
            name: 'دبل تشيز برجر مدخن',
            description:
              'شريحتين لحم مشوي مع شيدر مزدوج وبصل مكرمل وصوص باربكيو مدخن.',
            price: '215.00',
          },
          {
            name: 'مشروم سويس برجر',
            description: 'برجر لحم مشوي مع مشروم سوتيه وجبنة سويسري سايحة.',
            price: '175.00',
          },
          {
            name: 'بافلو برجر هلابينو حار',
            description:
              'برجر لحم بقري مشوي مع جبنة شيدر وهالبينو طازج وصوص بافلو حار.',
            price: '165.00',
          },
        ],
      },
      {
        title: 'فرايد تشيكن',
        linkAddons: true,
        products: [
          {
            name: 'تشيكن كرسبي ساندوتش',
            description: 'صدر دجاج مقرمش مع خس ومخلل ومايونيز في خبز بريوش.',
            price: '135.00',
          },
          {
            name: 'سبايسي تشيكن رانش',
            description: 'فرايد تشيكن حار مع صوص رانش وشريحة شيدر.',
            price: '150.00',
          },
          {
            name: 'تشيكن ستربس كرسبي (5 قطع)',
            description: '5 قطع فيليه دجاج مقرمش بالتتبيلة السرية مع صوص رانش.',
            price: '140.00',
          },
        ],
      },
      {
        title: 'مقبلات وبطاطس',
        linkAddons: true,
        products: [
          {
            name: 'بطاطس فريسكاس بالجبنة',
            description: 'بطاطس مقرمشة مغطاة بصوص جبنة شيدر دافئ.',
            price: '75.00',
          },
          {
            name: 'حلقات بصل مقرمشة (6 قطع)',
            description: '6 قطع حلقات بصل مقرمشة ذهبية مع صوص باربكيو.',
            price: '60.00',
          },
          {
            name: 'أصابع موتزاريلا (5 قطع)',
            description: '5 أصابع جبنة موتزاريلا مقلية مقرمشة.',
            price: '80.00',
          },
        ],
      },
      {
        title: 'المشروبات',
        linkAddons: false,
        products: [
          {
            name: 'كوكاكولا كانز',
            description: 'كوكاكولا باردة 330 مل.',
            price: '25.00',
          },
          {
            name: 'ميلك شيك شوكولاتة',
            description: 'ميلك شيك شوكولاتة غني مع كريمة مخفوقة.',
            price: '70.00',
          },
        ],
      },
    ],
    addons: [
      { name: 'قطعة برجر لحم إضافية', price: '65.00' },
      { name: 'شريحة جبنة شيدر أمريكي', price: '25.00' },
      { name: 'صوص جبنة شيدر دافئ', price: '30.00' },
      { name: 'بصل مكرمل', price: '20.00' },
      { name: 'هالبينو حار', price: '15.00' },
      { name: 'بطاطس مقلية وسط', price: '45.00' },
    ],
    offers: [
      {
        title: 'كومبو الثنائي المدخن',
        description:
          '2 دبل تشيز برجر مدخن على اللهب + بطاطس فريسكاس بالجبنة + 2 كوكاكولا كانز.',
        initialPrice: '555.00',
        realPrice: '449.00',
        durationDays: 35,
      },
      {
        title: 'بوكس فرايد تشيكن للصحاب',
        description:
          '2 ساندوتش تشيكن كرسبي + 5 قطع ستربس مقرمش + حلقات بصل + 2 كوكاكولا.',
        initialPrice: '520.00',
        realPrice: '415.00',
        durationDays: 25,
      },
      {
        title: 'عرض مشروم سويس الفردي',
        description:
          'مشروم سويس برجر بصوص الجبنة السويسرية + بطاطس فريسكاس + ميلك شيك شوكولاتة.',
        initialPrice: '320.00',
        realPrice: '259.00',
        durationDays: 30,
      },
      {
        title: 'ميكس المقرمشات والشيرنج',
        description:
          'أصابع موتزاريلا (5 قطع) + حلقات بصل مقرمشة (6 قطع) + بطاطس فريسكاس بالجبنة الشيدر.',
        initialPrice: '215.00',
        realPrice: '169.00',
        durationDays: 20,
      },
      {
        title: 'عرض كلاسيك الغداء السريع',
        description:
          'كلاسيك بافلو برجر لحم مشوي + بطاطس مقلية + كوكاكولا كانز مثلج.',
        initialPrice: '215.00',
        realPrice: '175.00',
        durationDays: 40,
      },
    ],
  },
];
