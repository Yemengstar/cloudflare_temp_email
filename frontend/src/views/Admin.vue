<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../store'

import SenderAccess from './admin/SenderAccess.vue'
import Statistics from "./admin/Statistics.vue"
import SendBox from './admin/SendBox.vue';
import Account from './admin/Account.vue';
import CreateAccount from './admin/CreateAccount.vue';
import Mails from './admin/Mails.vue';
import MailsUnknow from './admin/MailsUnknow.vue';
import Maintenance from './admin/Maintenance.vue';

const {
  localeCache, adminAuth, showAdminAuth, adminTab, loading
} = useGlobalState()
const message = useMessage()

const authFunc = async () => {
  try {
    location.reload()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      accessHeader: 'Admin Password',
      accessTip: 'Please enter the admin password',
      mails: 'Emails',
      account: 'Account',
      account_create: 'Create Account',
      unknow: 'Mails with unknow receiver',
      senderAccess: 'Sender Access Control',
      sendBox: 'Send Box',
      maintenance: 'Maintenance',
      ok: 'OK',
    },
    zh: {
      accessHeader: 'Admin 密码',
      accessTip: '请输入 Admin 密码',
      mails: '邮件',
      account: '账号',
      account_create: '创建账号',
      unknow: '无收件人邮件',
      senderAccess: '发件权限控制',
      sendBox: '发件箱',
      maintenance: '维护',
      ok: '确定',
    }
  }
});

onMounted(async () => {
  if (!adminAuth.value) {
    showAdminAuth.value = true;
    return;
  }
})
</script>

<template>
  <div>
    <n-modal v-model:show="showAdminAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
      :title="t('accessHeader')">
      <p>{{ t('accessTip') }}</p>
      <n-input v-model:value="adminAuth" type="textarea" :autosize="{ minRows: 3 }" />
      <template #action>
        <n-button @click="authFunc" type="primary" :loading="loading">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <Statistics />
    <n-tabs type="card" v-model:value="adminTab">
      <n-tab-pane name="account" :tab="t('account')">
        <Account />
      </n-tab-pane>
      <n-tab-pane name="account_create" :tab="t('account_create')">
        <CreateAccount />
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <Mails />
      </n-tab-pane>
      <n-tab-pane name="unknow" :tab="t('unknow')">
        <MailsUnknow />
      </n-tab-pane>
      <n-tab-pane name="senderAccess" :tab="t('senderAccess')">
        <SenderAccess />
      </n-tab-pane>
      <n-tab-pane name="sendBox" :tab="t('sendBox')">
        <SendBox />
      </n-tab-pane>
      <n-tab-pane name="maintenance" :tab="t('maintenance')">
        <Maintenance />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
