import { curriculumRewardCharacters } from './curriculum-cosmetics.mjs';
import { COMPANY_CAMPAIGNS } from './catalog.mjs';
import {
  CURRICULUM_BRANDS,
  CURRICULUM_IDENTITIES,
  curriculumCampaignIds,
} from './curriculum-brands.mjs';
import { CURRICULUM_CAMPAIGNS } from './curriculum.mjs';

export const COMPANY_BRANDS = Object.freeze([
  {
    format: 'revealline-brand-pack.v1',
    id: 'coupa',
    revision: 2,
    name: 'Coupa',
    description: 'Make room for tomorrow. An illustrated world of connected work.',
    publication: 'public',
    themeId: 'coupa-village',
    themeIds: [
      'coupa-village',
      ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'coupa').map((c) => `${c.id}-theme`),
    ],
    actorSetId: 'coupa-flower',
    logoAssetId: 'coupa-flower',
    heroAssetId: 'coupa-wallpaper-network-2024',
    iconAssetId: 'coupa-icon-512',
    fontAssetId: 'poppins-regular',
    assetIds: [
      'coupa-flower',
      'coupa-wallpaper-network-2024',
      'coupa-wallpaper-center-2024',
      'poppins-regular',
      'poppins-license',
      'coupa-icon-512',
    ],
    sources: [
      {
        title: 'Coupa brand library — official flower identity',
        url: 'https://drive.google.com/drive/folders/1Bhq6KoBjES--iHt3gWZA2rhjo456Q9j6',
        kind: 'official',
      },
      {
        title: 'Life at Coupa — current company values',
        url: 'https://careers.coupa.com/en/life-at-coupa/',
        kind: 'official',
      },
      {
        title: 'Poppins — SIL Open Font License',
        url: 'https://github.com/google/fonts/tree/main/ofl/poppins',
        kind: 'license',
      },
    ],
  },
  {
    format: 'revealline-brand-pack.v1',
    id: 'droneaid',
    revision: 1,
    name: 'DroneAid',
    description: 'Small connections. Shared possibilities. A community workshop adventure.',
    publication: 'public',
    themeId: 'droneaid-community',
    actorSetId: 'community-marker',
    logoAssetId: 'droneaid-logo',
    heroAssetId: 'droneaid-home',
    iconAssetId: 'droneaid-icon-512',
    fontAssetId: 'poppins-regular',
    assetIds: [
      'droneaid-logo',
      'droneaid-home',
      'poppins-regular',
      'poppins-license',
      'droneaid-icon-512',
    ],
    sources: [
      {
        title: 'DroneAid Collective Portugal — regional identity',
        url: 'https://drone-aid.pt/en',
        kind: 'official',
      },
      {
        title: 'DroneAid Germany — community workshops',
        url: 'https://drone-aid.de/',
        kind: 'official',
      },
      {
        title: 'Poppins — SIL Open Font License',
        url: 'https://github.com/google/fonts/tree/main/ofl/poppins',
        kind: 'license',
      },
    ],
  },
  {
    format: 'revealline-brand-pack.v1',
    id: 'droneaid-nl',
    revision: 2,
    name: 'DroneAid Netherlands',
    description:
      'Build FPV drones together. Fictional workshop and donation adventures inspired by DroneAid Netherlands and its support for Ukraine.',
    publication: 'public',
    themeId: 'droneaid-nl-community',
    themeIds: [
      'droneaid-nl-community',
      ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => `${c.id}-theme`),
    ],
    actorSetId: 'droneaid-nl-propeller',
    logoAssetId: 'droneaid-nl-logo',
    heroAssetId: 'droneaid-nl-workshop-lights-01-reveal-v2',
    iconAssetId: 'droneaid-nl-icon-512',
    fontAssetId: null,
    assetIds: [
      'droneaid-nl-logo',
      'droneaid-nl-propeller',
      'droneaid-nl-icon-512',
      'droneaid-nl-workshop-lights-01-reveal-v2',
    ],
    sources: [
      {
        title: 'DroneAid Netherlands — official identity and workshop activities',
        url: 'https://drone-aid.nl/en',
        kind: 'official',
      },
      {
        title: 'DroneAid Netherlands — public reporting',
        url: 'https://drone-aid.nl/en/reports',
        kind: 'official',
      },
    ],
  },
  ...CURRICULUM_BRANDS,
]);

const choices = [
  ...CURRICULUM_IDENTITIES.map((item) => [
    item.id,
    item.id,
    item.name,
    'learners',
    curriculumCampaignIds(item.id),
  ]),
  [
    'coupa-all',
    'coupa',
    'Coupa Village',
    'everyone',
    COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'coupa').map((c) => c.id),
  ],
  ['coupa-adventure', 'coupa', 'Spend in Motion', 'public', ['coupa-spend-in-motion']],
  ['coupa-culture', 'coupa', 'Inside the Village', 'culture', ['coupa-inside-village']],
  ['coupa-foundations', 'coupa', 'From Need to Value', 'learners', ['coupa-source-to-pay']],
  ['coupa-operations', 'coupa', 'A Day in Coupa', 'operators', ['coupa-product-operations']],
  [
    'coupa-developers',
    'coupa',
    'Connect the Network',
    'developers',
    ['coupa-developer-integration'],
  ],
  ['droneaid-community', 'droneaid', 'Community Relay', 'public', ['droneaid-community-relay']],
  [
    'droneaid-nl-community',
    'droneaid-nl',
    'DroneAid Netherlands',
    'public',
    COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => c.id),
  ],
  ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === 'droneaid-nl').map((c) => [
    c.id,
    c.brandId,
    c.name,
    'public',
    [c.id],
  ]),
];
// Exact pre-art snapshots; their bytes must never be reformatted or overwritten.
const retainedPresentations = Object.freeze({
  'victory-drones': [
    {
      id: '9685f48ccc6c053c69aebb695a1f31e66e54a839806e8956d816258cc07906d8',
      path: 'game/editions/retained/victory-drones-before-showcase-learning.json',
      sha256: '490ed135f5d9e8cb55172dc584a671f6d385afb62c360545b848edfaa1521b2b',
      bytes: 169999,
    },
    {
      id: 'abcba1ea9574640497faf043f8caf26a039f1355d34df68f3e2f8546690439b4',
      path: 'game/editions/retained/victory-drones-before-discovery-feedback.json',
      sha256: '6b382368da6a6eed020ac00fa1703910992ca38a2205b8904ce23a23d68b5dec',
      bytes: 142313,
    },
    {
      id: 'afeb4333ec165a3ecbaa01bce74822744e2f56238f7608701284bcbd436638b3',
      path: 'game/editions/retained/victory-drones-before-mission-art-4.json',
      sha256: 'c011e7dab14bcc0eb5dd5fcb697c8affc6e5f72cd4dffe63b20c3971b3c7a12a',
      bytes: 132017,
    },
    {
      id: '6de52c0aa1ae09a7f9699adb5d73f69c779a5220e003434cb6dfe5c6333bff9f',
      path: 'game/editions/retained/victory-drones-before-profiles-art-3.json',
      sha256: '60cc300a3d75072732afbb76dd258899d4a0134b7e5c1f9c7130773a852eb4be',
      bytes: 115252,
    },
    {
      id: '36e42f75903c47abf1c23da0f22f46b74498284cdf84abd0b5f36b10d5838037',
      path: 'game/editions/retained/victory-drones-first-discoveries.json',
      sha256: '3c2bf181cf224dcc1a477a1b17ccfa7109f06803af31f49e9af379a40deb290f',
      bytes: 114051,
    },
  ],
  'social-drone-ua': [
    {
      id: '3a82bd8aa3306adf9f02be6f56945985b7e54e1606fc3156a2271ba19bbd16a6',
      path: 'game/editions/retained/social-drone-ua-before-showcase-learning.json',
      sha256: '1a360b73d74bfec5bae456e15e1e1f1a42f7c400bc04f0275b342c46160be98f',
      bytes: 176323,
    },
    {
      id: '985d7722d69526a98abc1d7026c2279ace2a64443362dcc861aab6cd92fb608b',
      path: 'game/editions/retained/social-drone-ua-before-mission-alt.json',
      sha256: '13d119e2e5aa67bd6636a2d83d9e1374d792a05edc33c462654f19d965efe409',
      bytes: 176563,
    },
    {
      id: 'b082d3766168bd305e235adad284813b2a8578de5de009f8ca985aaf1a2e5bd6',
      path: 'game/editions/retained/social-drone-ua-before-listening-room.json',
      sha256: 'd1637bf018f2197a6e10e6df5a13fe2e8cff807d4c19165258bff331ccc30528',
      bytes: 170542,
    },
    {
      id: '9ae68b77e05e8b2a0dc934510e080af89ee5223a3304a0197c3b53a2e61af1b0',
      path: 'game/editions/retained/social-drone-ua-before-discovery-feedback.json',
      sha256: 'edf36f70669fae75d00038bdba4339ecbdd5e03e7647972f64922ee51e7a879b',
      bytes: 143061,
    },
    {
      id: '943441d44205dfced2e89cf47738d2fd6cc22e886cbd0fbea5bb24d77177e0de',
      path: 'game/editions/retained/social-drone-ua-before-mission-art-4.json',
      sha256: '2feb17e46711d4cb402ff8b7f6f913b7ac137d20663da049bf22391311bfdf7c',
      bytes: 141818,
    },
    {
      id: '776e569d90c869e8cdf96beb046d21d9f5439fde57c9fbe991119e4029e0dcd6',
      path: 'game/editions/retained/social-drone-ua-before-profiles-art-3.json',
      sha256: '99d0b6019310a08b71a379571e75a7ae0c16bd81a6b3004fe550f77aaa42bfee',
      bytes: 115730,
    },
    {
      id: '95c2f3c78f07732c3d804e042b5c5a1bb56d9c38f79330b1d09135f46affecd5',
      path: 'game/editions/retained/social-drone-ua-first-discoveries.json',
      sha256: 'c44f6757b369f0ac7c08a86e6ee4b5633ab707cd8f6624d9e43b2b719ac08aaa',
      bytes: 114183,
    },
  ],
  'ukraine-culture': [
    {
      id: '3e868c83c369a31d78e3a551e8b83b6179bba80543dca9df19cbb73566deb295',
      path: 'game/editions/retained/ukraine-culture-before-showcase-learning.json',
      sha256: '953829f1b939d98e7bcd66860977504caaa4a2c5a847a1d389aa9398deabcea2',
      bytes: 599212,
    },
    {
      id: '430cb1cb0c5231f9c42dc9fd9d2b0e55b35a49c676e09c0df8effa17f9a396b2',
      path: 'game/editions/retained/ukraine-culture-before-textile-and-motion.json',
      sha256: 'c7122ae0c8f17932986df03fc636c02900d83a30c235529789f0a90f253c7555',
      bytes: 587410,
    },
    {
      id: '95915f9348a50bb93f6c5d234624f85fc1a758f59d1db2bb4f804876257a3c25',
      path: 'game/editions/retained/ukraine-culture-before-visual-atlas.json',
      sha256: 'fb63b425bdc90769bdb9a5f7bbb8a3d4a3c18086bee0d87f4187712398e4dcb0',
      bytes: 574139,
    },
    {
      id: '004d6874394bf5d37967eb841fa0004c4980d40169f7154b425ab3fcdea83e58',
      path: 'game/editions/retained/ukraine-culture-before-discovery-feedback.json',
      sha256: 'ce5fbde12003892ad63b17b71ee03ff897ba1a81d021271dfe613b44260adcc0',
      bytes: 462558,
    },
    {
      id: 'b056de12bcb25f16bc3ed5324b5a0e1a7e30f2614a37eb244675ef02a8c2a805',
      path: 'game/editions/retained/ukraine-culture-before-profiles-art-3.json',
      sha256: '3940adef9e74a5f5cd83615c26cce573442dfc5685d6855998864772dbc14623',
      bytes: 398396,
    },
    {
      id: '976af38b7451ae581864ff9baef4975cab0c3feb385fa73ea8d3680e43ed5742',
      path: 'game/editions/retained/ukraine-culture-before-mission-art-2.json',
      sha256: '0a85908023fea2213d21813275fefd58211ee9b08377e2caeca77463a969db36',
      bytes: 371603,
    },
    {
      id: 'c92804d620efc050f08aacc1428bf20a5517d5f89488daf07abc67c336815e7f',
      path: 'game/editions/retained/ukraine-culture-first-discoveries.json',
      sha256: '3f5b41552fcda8d940c21898922f5fd5cdf638b169f50a846f43d301b25a6b64',
      bytes: 61157,
    },
  ],
  'fpv-learning': [
    {
      id: '2b0c8781faf178c7e7952018a07ad290af67cf32217eedcbeeacf9a42c732ace',
      path: 'game/editions/retained/fpv-learning-before-showcase-learning.json',
      sha256: '80dd4e88f348c3ec62f9a12069e897de690f87169eb1280dc9e4b7da694b83e2',
      bytes: 734363,
    },
    {
      id: 'a34183de94677f3e2d20a88062a3643778723a34b53a57c606eb667740e9d70c',
      path: 'game/editions/retained/fpv-learning-before-textile-and-motion.json',
      sha256: 'e50b6a3c0197f4944756942af314e31a76a2db559b505a23d310185e834a0289',
      bytes: 727944,
    },
    {
      id: '2ccf3e4f9b9066359219e3fdcd2dad32366f9ea3e2cf12d1b16c0de09d36c604',
      path: 'game/editions/retained/fpv-learning-before-visual-atlas.json',
      sha256: '03035e3f1eaefd245d5ad54706055456205ba26c003fd25c1a6f0ab25dce6a4e',
      bytes: 719041,
    },
    {
      id: '089b0801b048970f1920e76b03ceda92f389e256c5e38e45c5e25abeebe04f0d',
      path: 'game/editions/retained/fpv-learning-before-discovery-feedback.json',
      sha256: 'ea7a462be267c911997c876c73a92b458a56932ab317e7a70dec6eadc5655d6c',
      bytes: 583333,
    },
    {
      id: '5c23ab5e0b883f17e9de0df3a5b8b41010a86da1c495969c6e0efcc96658bdea',
      path: 'game/editions/retained/fpv-learning-before-mission-art-4.json',
      sha256: '90939f3f49659cebf802393ff598e0b75a22107839303cd73ca69d91c0de7383',
      bytes: 574334,
    },
    {
      id: '108c4348f0a40c6e6b48387a9fa81d95161f006f842d1239e3048986c29696b2',
      path: 'game/editions/retained/fpv-learning-before-profiles-art-3.json',
      sha256: 'd874dc8bac209d8095b3316117278adce8c02579e120c19c373366750fe15023',
      bytes: 481396,
    },
    {
      id: 'ace3662d4631d798e58b5eeea22d4f0d2c3fc8bf538f6a7a47bcb54ae6938fd0',
      path: 'game/editions/retained/fpv-learning-before-mission-art-2.json',
      sha256: '4bd5a789d5f2d35b97ef16ab28ecabebdaf610d56493ec25c34225af1a4c8df6',
      bytes: 473797,
    },
    {
      id: 'd5188109991148940036debb16fabe91d600104b3e82d4670efa5aed5dabfa16',
      path: 'game/editions/retained/fpv-learning-first-discoveries.json',
      sha256: 'def9f98137328c4545cb26729e0e563b1727cda637bec66990fd0f788e5d6e98',
      bytes: 59411,
    },
  ],
  'coupa-all': [
    {
      id: '13e5c4ff2313ebd3714e6d6461e2468857be6e4997fede8da24542880951df13',
      path: 'game/editions/retained/coupa-all-before-learning-bonus.json',
      sha256: 'de8370665d5c99e953326e1861f0817afb3dfc511f0629cdec6f50c6d4b5c709',
      bytes: 191970,
    },
    {
      id: 'ecb87b6208f6f55322188ab34d8d9aa63b94064dd346f400bbe2bbbcc9d7870b',
      path: 'game/editions/retained/coupa-all.json',
      sha256: 'a48dc47e3e788046de0094c7d34bd74eda0c8776f271131254e26f5ec12e5706',
      bytes: 146284,
    },
    {
      id: 'd9deabcadfd9bdc7622da65ebbcc91bdd752db02234009edc3fe09f85812f842',
      path: 'game/editions/retained/coupa-all-fb207466c.json',
      sha256: '680c7f4fdb23619aed0627ea47444c7040a7f208104e4c2abc1a3d486adbe636',
      bytes: 148510,
    },
    {
      id: 'c55614c27b1c70e0ac9d0701d3defbfbb03262ecfe3e8458d436958bdaf96561',
      path: 'game/editions/retained/coupa-all-before-discovery-rewards.json',
      sha256: '4d79d4b009d3496712fe6919bb02730dc6fbe4c3d7191908bf75db75a989865b',
      bytes: 165206,
    },
  ],
  'coupa-adventure': [
    {
      id: '82527f475e9cb0ddbc6bf9701e495e49e08dd635a0e89578c107268373426a05',
      path: 'game/editions/retained/coupa-adventure-fb207466c.json',
      sha256: 'ef9a0bf6562fa74ab643d9b214bf1deb1338a1694337cdd822d9cb3cd3c26937',
      bytes: 29600,
    },
    {
      id: '77db1de24b49c04417f38b32002177590c92b353c17e5e9f580f44207e5fccf1',
      path: 'game/editions/retained/coupa-adventure-before-discovery-rewards.json',
      sha256: 'e251352b441ac1352802030be0bd6e9e2aed6a48e38dff8eee572c1d26221902',
      bytes: 33391,
    },
  ],
  'coupa-culture': [
    {
      id: 'ed8d7747ad136a06243a2cf8c90dacdc5cf42dc71f5c6448174bde48ea241ae8',
      path: 'game/editions/retained/coupa-culture-fb207466c.json',
      sha256: '12dbf430730aff337133b19e1140efc2c107cc18351b07048eef59c19593bcba',
      bytes: 44733,
    },
  ],
  'coupa-foundations': [
    {
      id: 'bb5393ff4a73f30346496334ac6004d84766dfbd958dbdfb62d2b3554e20d429',
      path: 'game/editions/retained/coupa-foundations-before-learning-bonus.json',
      sha256: '0ee0079828321ec31cfc6f0683f76ec5a8e90d7065008626793e33195f6a1187',
      bytes: 50235,
    },
    {
      id: '57dd4d5b7e0f8c27662349a8af870862657d700682ac758ad51721a61fdd59aa',
      path: 'game/editions/retained/coupa-foundations.json',
      sha256: '98d2a026fc89b48cbd76c2d2c2d74d491f666583ae819324f855ebd7f309dd90',
      bytes: 46542,
    },
    {
      id: '176ab6d261ed0e4366b570dd14df270d6b27a761404baf17921dc1f974898bd6',
      path: 'game/editions/retained/coupa-foundations-fb207466c.json',
      sha256: 'e6694057707e69a8a134836d91bc1879f3555b39f6fc58622a15073454bf7432',
      bytes: 47276,
    },
  ],
  'coupa-operations': [
    {
      id: '99254aaf116f5b68881ef51f36c7b5b9ebfbcf6cce371de90c8234c07862a43d',
      path: 'game/editions/retained/coupa-operations.json',
      sha256: '716bcbd296e6053ca6628b8b55dada9c0489a8893c1044cbc24854899caf6e20',
      bytes: 47693,
    },
    {
      id: '681f63d8afef4e5a89e3d62ac1a2ddaa775cf6d03ad2c3897c64bc2dfb84b922',
      path: 'game/editions/retained/coupa-operations-fb207466c.json',
      sha256: 'b00276030dd4642756c75e15120f2d415e07e85dc90b0eacf99cf0ee71574c3d',
      bytes: 48443,
    },
  ],
  'coupa-developers': [
    {
      id: '72ede618c25678c324d39389b9789130c66bb05f461e900d367e9c3f2a878224',
      path: 'game/editions/retained/coupa-developers.json',
      sha256: 'ee4d10212133066658ae5543883a5e1def3602a5bc840874223b90bdccac9c06',
      bytes: 50046,
    },
    {
      id: 'ab769c5bd0c8e9cfeb09c20c9363a6012d482b911aec1577c6665d264490127a',
      path: 'game/editions/retained/coupa-developers-fb207466c.json',
      sha256: 'd4bc46ff2c873a07325b9efec577e1df854b85479f3ba10a89ceb2a0db019d9a',
      bytes: 50786,
    },
  ],
  'droneaid-nl-community': [
    {
      id: '13bf4f80b1b055d9fb5abdc137dfc93b94fe4ba55072104e697fb29615374679',
      path: 'game/editions/retained/droneaid-nl-community-fb207466c.json',
      sha256: 'b68b453158c820a542051999f242643250439a55e532653555940ffa31bbd055',
      bytes: 118479,
    },
    {
      id: '3445135910a80ceb5b5fdb862c431ead7db00a09631ede2ec28426119d907f67',
      path: 'game/editions/retained/droneaid-nl-community-475bccde4.json',
      sha256: '27669f1fa5d8692e6314bfd5d600c5554dee6679c364f7109a5663e8653856bc',
      bytes: 146882,
    },
    {
      id: '389459b2b3b2a5b330a053b9eaf11918878a8f19688e035cd19b641744f98c85',
      path: 'game/editions/retained/droneaid-nl-community-38d320f48.json',
      sha256: '24c8cdff37378db2fdd5e405e650a0512ae5fa308188b3ce76b68b02ab71a8fa',
      bytes: 148331,
    },
    {
      id: '8b53a415ac9b76ebd25aca2ac7b67464f026e43e39185970c59501e6f918e3cb',
      path: 'game/editions/retained/droneaid-nl-community-before-discovery-rewards.json',
      sha256: '3fc0e4773277c7a126195cbe68a37c5182871d93e29f82c50c9a0064eedd5d58',
      bytes: 148338,
    },
  ],
  'droneaid-nl-workshop-lights': [
    {
      id: '4e9e2e8ebc38f4bf6ae0b5a06144c103947cb90704b6646800bec534bcbf5c14',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-fb207466c.json',
      sha256: 'ace1b2e55b06ba220e26d52dc2ca282b8100f1c5bddd40e1656363c20ba6ad45',
      bytes: 29573,
    },
    {
      id: '115d034320ff3efb161abd00b5886485bd92c7a161d405e5f8cb384263480b70',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-475bccde4.json',
      sha256: '4099c606f57300678a6874695da6fc1c0af8b1ec2402e1cb1277cd339694f0ca',
      bytes: 33575,
    },
    {
      id: 'f4882beacf8fc6bb07aaee36b818541df42b08c0e64ffcc461a2744f6503d302',
      path: 'game/editions/retained/droneaid-nl-workshop-lights-before-discovery-rewards.json',
      sha256: 'b3246af4f642600a818e9f9e0ba496aaef5c720a5be9d4651c90672ee247a7bc',
      bytes: 34100,
    },
  ],
  'droneaid-nl-parts-in-motion': [
    {
      id: '0b402f348a0d84f534c5db803d731394f7120160d7fd9c538887a4361a20ae40',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-fb207466c.json',
      sha256: 'a565f9a298e5adac88570474e4a484458e8c216fc34b9269274a55738d08a36c',
      bytes: 33974,
    },
    {
      id: 'e8c32e78d0ef5bf6f09a08cbe2ccaf244ec4917c877bce69c2fdf9cb3f38673b',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-475bccde4.json',
      sha256: '62aa48212ba19ede5bbc12064fc0fda026c2703ca8fef777d1d6657ba0d802e2',
      bytes: 38774,
    },
    {
      id: '375300b9464b5a567c7cc8888e9a46f6f3e00cb01de0a25bf5cf2eff3c3b5f01',
      path: 'game/editions/retained/droneaid-nl-parts-in-motion-38d320f48.json',
      sha256: '09591e6100464171e9113227d37200bf68c2446440e58e0efad718b1c52e3930',
      bytes: 39189,
    },
  ],
  'droneaid-nl-makers-together': [
    {
      id: '609db6d6c7ea54120531b53b2b5c54b26d1484306195a426c39bd40d5236b478',
      path: 'game/editions/retained/droneaid-nl-makers-together-fb207466c.json',
      sha256: '21a7b3be9a7850d2f89b250903670b2fc6d98a7ffc32d8659ab1dd79d1e53937',
      bytes: 34640,
    },
    {
      id: '8c7d12be0f28ca874e88bbb453ab06fc947245681e8a4fc851b0c70a88314488',
      path: 'game/editions/retained/droneaid-nl-makers-together-475bccde4.json',
      sha256: '4bdd87457f48ef2123d7d4dfe608c9161d8ba493dd2f4039be45dcf81595b437',
      bytes: 39429,
    },
  ],
  'droneaid-nl-careful-handoff': [
    {
      id: 'fb9dafae437c37905dcdd07cec0f67b53ead801a8894c2bf2070309dfd16a913',
      path: 'game/editions/retained/droneaid-nl-careful-handoff-fb207466c.json',
      sha256: '20f0a33e045c38ba73b19e5cfc7823378a23a1d81129677aea15474be1dd640a',
      bytes: 35799,
    },
    {
      id: '2cb54a68ee115af048b210d130af7418d44307adbeb69ab54dbc4fc0418cacd7',
      path: 'game/editions/retained/droneaid-nl-careful-handoff-475bccde4.json',
      sha256: '18d7a8f5324dc39a648eaeab9457e3d4c07814fd81f297e6c774bee6ae60e847',
      bytes: 40708,
    },
  ],
  'droneaid-nl-signals-of-support': [
    {
      id: '013849c9507447451ca1f9a58d845da2d44436dbf776b231162ab8715cc61863',
      path: 'game/editions/retained/droneaid-nl-signals-of-support-fb207466c.json',
      sha256: '62e89a9c88e6812bc41bb36fab7c6af1ff7c818e8c91d7476ff488e891b20450',
      bytes: 37264,
    },
    {
      id: '048f59ae3ab8452c1e2f387a15dc10baad8d88c921663e2c576e7ad2fffa2b44',
      path: 'game/editions/retained/droneaid-nl-signals-of-support-475bccde4.json',
      sha256: 'afcd187771ec49ac54194b970930d1df0ee382da18368594dcadf14604f07bf7',
      bytes: 42294,
    },
  ],
  'droneaid-nl-shared-horizon': [
    {
      id: '1c5fc1701fb224c9a548d1540b19e2f8c893b43c6bc81d2b91a0bb65d3bcf0a6',
      path: 'game/editions/retained/droneaid-nl-shared-horizon-fb207466c.json',
      sha256: '51eb77a2b7499f7af923189e620315c05dc142f2766e7b605fc13522dbdafa1b',
      bytes: 37998,
    },
    {
      id: 'fb225362d153cdd9af4d0421e7e7905521bb0d926cab7557985d40982924e429',
      path: 'game/editions/retained/droneaid-nl-shared-horizon-475bccde4.json',
      sha256: 'e1e31c174b40a97cfe0d43998bd91a4dd3eb314183f7bd5c29de618a51859977',
      bytes: 42871,
    },
  ],
});

export const COMPANY_EDITIONS = Object.freeze(
  choices.map(([id, brandId, name, audience, campaignIds]) => ({
    format: 'revealline-edition.v1',
    id,
    revision:
      id === 'coupa-all'
        ? 8
        : id === 'coupa-foundations'
          ? 7
          : [
                'coupa-adventure',
                'droneaid-nl-community',
                'coupa-operations',
                'coupa-developers',
              ].includes(id)
            ? 6
            : brandId === 'coupa'
              ? 5
              : ['droneaid-nl-workshop-lights', 'droneaid-nl-parts-in-motion'].includes(id)
                ? 5
                : brandId === 'droneaid-nl'
                  ? 4
                  : id === 'fpv-learning'
                    ? 9
                    : id === 'social-drone-ua'
                      ? 8
                      : id === 'ukraine-culture'
                        ? 8
                        : id === 'victory-drones'
                          ? 6
                          : [
                                'social-drone-ua',
                                'victory-drones',
                                'ukraine-culture',
                                'fpv-learning',
                              ].includes(id)
                            ? 5
                            : 1,
    name,
    brandId,
    audience,
    campaignIds,
    entryCampaignId: campaignIds[0],
    modes: ['solo'],
    publication: 'public',
    ...(retainedPresentations[id] ? { presentationHistory: retainedPresentations[id] } : {}),
    boot: Object.fromEntries(
      ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((key) => [
        key,
        `game/content/company-boot/${id}/${key}.json`,
      ]),
    ),
  })),
);

const palettes = {
  ...Object.fromEntries(CURRICULUM_IDENTITIES.map((item) => [item.id, item.palette])),
  coupa: {
    ink: '#081D4D',
    paper: '#FFFFFF',
    muted: '#B8CAE5',
    accent: '#5FD6FF',
    safe: '#96EAAA',
    danger: '#FF9A88',
    field: '#081D4D',
    grid: '#193866',
    sky: '#D8F0FF',
    land: '#1565C0',
  },
  'droneaid-nl': {
    ink: '#0D0B2E',
    paper: '#FFFFFF',
    muted: '#BFCBF3',
    accent: '#FFD62C',
    safe: '#96EAAA',
    danger: '#FF9A88',
    field: '#0D0B2E',
    grid: '#2C286D',
    sky: '#DCEBFD',
    land: '#4238EB',
  },
  droneaid: {
    ink: '#12251C',
    paper: '#FAFBF7',
    muted: '#B8CEBA',
    accent: '#F2BD6E',
    safe: '#96D4AD',
    danger: '#FFA58F',
    field: '#10291D',
    grid: '#284638',
    sky: '#DDEDE0',
    land: '#14532D',
  },
};
export function createCompanyTheme(brandId) {
  const brand = COMPANY_BRANDS.find((item) => item.id === brandId);
  if (!brand) throw new TypeError('Choose a registered company.');
  const player = brand.actorSetId;
  const curriculum = CURRICULUM_IDENTITIES.find((item) => item.id === brandId);
  return {
    id: brand.themeId,
    name: brand.name,
    subtitle: curriculum
      ? 'Explore, connect and discover something worth keeping.'
      : brandId === 'coupa'
        ? 'Connected work. Shared possibilities.'
        : 'Build together. Connect the community.',
    family: 'company',
    player,
    scene: 'network',
    enemyShape: 'cube',
    patrolShape: 'spark',
    bossShape: 'core',
    actorRecipes: curriculum
      ? Object.fromEntries(
          [
            'bouncer',
            'border-patrol',
            'contour-patrol',
            'claimed-rover',
            'eroder',
            'lane-boss',
            'relay-sentinel',
          ].map((role) => [role, curriculum.recipe]),
        )
      : brandId === 'droneaid-nl'
        ? Object.fromEntries(
            [
              'bouncer',
              'border-patrol',
              'contour-patrol',
              'claimed-rover',
              'eroder',
              'lane-boss',
              'relay-sentinel',
            ].map((role) => [role, 'fpv-whoop']),
          )
        : {
            bouncer: 'paper-tangle',
            'border-patrol': 'stale-fragments',
            'contour-patrol': 'missing-cloud',
            'claimed-rover': 'missing-cloud',
            eroder: 'stale-fragments',
            'lane-boss': 'backlog-knot',
            'relay-sentinel': 'backlog-knot',
          },
    soundtrack: curriculum
      ? {
          id: `${brandId}-discovery`,
          name: curriculum.name,
          genre: curriculum.genre,
          tempo: curriculum.tempo,
          root: curriculum.root,
          scale: curriculum.genre === 'ambient' ? 'dorian' : 'major',
        }
      : brandId === 'coupa'
        ? {
            id: 'village-connections',
            name: 'Village Connections',
            genre: 'chiptune',
            tempo: 108,
            root: 60,
            scale: 'major',
          }
        : {
            id: brandId === 'droneaid-nl' ? 'workshop-first-light' : 'workshop-after-rain',
            name: brandId === 'droneaid-nl' ? 'Workshop First Light' : 'Workshop After Rain',
            genre: 'ambient',
            tempo: 72,
            root: 57,
            scale: 'dorian',
          },
    classBodies: Object.fromEntries(
      ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'].map((id) => [
        id,
        player,
      ]),
    ),
    labels: {
      objective: 'Connection',
      supply: 'Support station',
      enemy: curriculum?.enemy ?? (brandId === 'droneaid-nl' ? 'Practice quad' : 'Paper tangle'),
      boss: curriculum?.enemy ?? (brandId === 'droneaid-nl' ? 'Practice lead' : 'Backlog knot'),
      currency: 'Connections',
      ability: 'Support',
    },
    palette: { ...palettes[brandId] },
    coverColor: palettes[brandId].field,
  };
}

export function createCompanyPresets(brandId) {
  const theme = createCompanyTheme(brandId);
  const rewardCharacters = curriculumRewardCharacters(brandId);
  const neutral = {
    label: 'Community marker',
    src: null,
    sourceStatus: 'Original directional marker',
    widthCells: 1.5,
    heightCells: 1.5,
    headingOffsetDegrees: 0,
    sampling: 'linear',
    rotors: [],
    animationRecipe: 'still',
  };
  return {
    version: '1.0.0',
    ...(rewardCharacters ? { rewardCharacters: rewardCharacters.rewardCharacters } : {}),
    characters: {
      ...rewardCharacters?.characters,
      'neutral-marker': { ...neutral },
      [theme.player]: {
        ...neutral,
        label: brandId === 'coupa' ? 'Coupa flower' : 'Community courier',
        ...(brandId === 'coupa'
          ? {
              src: '../../game/editions/assets/coupa/flower-blue.png',
              sourceStatus: 'Official Coupa flower; gameplay rotation chosen for this game',
              bodyMotion: { kind: 'rigid-spin', radiansPerSecond: Math.PI, travelGain: 0 },
              bodyBacking: { kind: 'opaque-interior', color: '#FFFFFF' },
            }
          : brandId === 'droneaid-nl'
            ? {
                label: 'DroneAid Netherlands propeller',
                src: '../../game/editions/assets/droneaid-nl/propeller.png',
                sourceStatus:
                  'Exact four propeller paths from the official Netherlands logo; gameplay rotation user-selected',
                widthCells: 2.3,
                heightCells: 2.3,
                bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 4 * Math.PI, travelGain: 0 },
              }
            : {}),
      },
    },
    animationRecipes: { still: { label: 'Rigid body', components: [] } },
  };
}

// Campaign palettes, material metaphors and sound are presentation only. All
// physical actor cues and deterministic movement remain owned by the engine.
const campaignLooks = {
  'coupa-spend-in-motion': [
    'Connected City',
    '#081D4D',
    '#1565C0',
    '#5FD6FF',
    'paper-tangle',
    'Paper tangle',
    'chiptune',
    108,
    60,
  ],
  'coupa-inside-village': [
    'Community Mosaic',
    '#112A55',
    '#276EC8',
    '#EEC874',
    'missing-cloud',
    'Missed connection',
    'ambient',
    84,
    62,
  ],
  'coupa-source-to-pay': [
    'Supply District',
    '#102A50',
    '#2469B5',
    '#8CDFE8',
    'stale-fragments',
    'Loose fragments',
    'chiptune',
    102,
    60,
  ],
  'coupa-product-operations': [
    'Operations Studio',
    '#102446',
    '#2864A3',
    '#E8C378',
    'paper-tangle',
    'Paper tangle',
    'chiptune',
    96,
    65,
  ],
  'coupa-developer-integration': [
    'Resource Atlas',
    '#08182F',
    '#214A97',
    '#5FD6FF',
    'backlog-knot',
    'Unresolved knot',
    'ambient',
    90,
    57,
  ],
  'droneaid-nl-workshop-lights': [
    'FPV Workshop',
    '#0D0B2E',
    '#4238EB',
    '#FFD62C',
    'fpv-whoop',
    'Practice quad',
    'chiptune',
    104,
    60,
  ],
  'droneaid-nl-parts-in-motion': [
    'FPV Component Depot',
    '#111339',
    '#4D55DA',
    '#FFD62C',
    'fpv-open-x',
    'Sorting quad',
    'chiptune',
    112,
    62,
  ],
  'droneaid-nl-makers-together': [
    'Drone Building Together',
    '#21163A',
    '#6550C9',
    '#F6D570',
    'fpv-stretched',
    'Relay quad',
    'ambient',
    88,
    65,
  ],
  'droneaid-nl-careful-handoff': [
    'FPV Donation Depot',
    '#111A36',
    '#4552BC',
    '#FFD62C',
    'fpv-caged',
    'Guarded quad',
    'chiptune',
    98,
    60,
  ],
  'droneaid-nl-signals-of-support': [
    'Workshop Open Day',
    '#20133C',
    '#6042CD',
    '#FFD62C',
    'fpv-antenna',
    'Signal quad',
    'chiptune',
    116,
    67,
  ],
  'droneaid-nl-shared-horizon': [
    'Ukraine Support Horizon',
    '#10112F',
    '#4740AD',
    '#FFE18B',
    'fpv-survey',
    'Horizon quad',
    'ambient',
    82,
    62,
  ],
};
export function createCompanyThemes(brandId) {
  const base = createCompanyTheme(brandId);
  return [
    base,
    ...CURRICULUM_CAMPAIGNS.filter((item) => item.brandId === brandId).map((item) => {
      const theme = { ...structuredClone(base), id: `${item.id}-theme` };
      if (!item.look) return theme;
      const { field, land, accent, recipe, enemy, genre, tempo, root } = item.look;
      return {
        ...theme,
        name: `${base.name} · ${item.name}`,
        subtitle: item.name,
        palette: { ...theme.palette, field, land, accent },
        coverColor: field,
        actorRecipes: Object.fromEntries(
          Object.keys(theme.actorRecipes).map((role) => [role, recipe]),
        ),
        labels: { ...theme.labels, enemy },
        soundtrack: {
          id: `${item.id}-score`,
          name: item.name,
          genre,
          tempo,
          root,
          scale: genre === 'ambient' ? 'dorian' : 'major',
        },
      };
    }),
    ...COMPANY_CAMPAIGNS.filter((c) => c.brandId === brandId && campaignLooks[c.id]).map(
      (campaign) => {
        const [name, field, land, accent, recipe, enemy, genre, tempo, root] =
          campaignLooks[campaign.id];
        return {
          ...structuredClone(base),
          id: `${campaign.id}-theme`,
          name: `${base.name} · ${name}`,
          subtitle: campaign.name,
          palette: { ...base.palette, field, land, accent },
          coverColor: field,
          actorRecipes: {
            ...base.actorRecipes,
            ...Object.fromEntries(
              (brandId === 'droneaid-nl' ? Object.keys(base.actorRecipes) : ['bouncer']).map(
                (role) => [role, recipe],
              ),
            ),
          },
          labels: { ...base.labels, enemy },
          soundtrack: {
            id: `${campaign.id}-score`,
            name,
            genre,
            tempo,
            root,
            scale: genre === 'ambient' ? 'dorian' : 'major',
          },
        };
      },
    ),
  ];
}
