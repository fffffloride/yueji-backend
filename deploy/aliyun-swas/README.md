# ����������Ӧ�÷���������

��Ŀ¼������һ̨ Ubuntu ����Ӧ�÷������ϲ�������ˡ�NestJS��MySQL��Redis �� MinIO��
Node.js ʹ�ùٷ� Node 22 LTS ���а���NestJS �� systemd �ػ���MySQL��Redis��MinIO
�� Nginx �� Docker Compose ������

## ���

- �����ˣ�`http://������IP/`
- ��ˣ��ɹ�����ͨ��ͬԴǰ׺ `/prod-api/` �������
- MinIO �����ļ���`/files/public/**`
- ����������飺`http://������IP/healthz`

���ݿ⡢Redis��MinIO �� NestJS ��ֻ���������˿ڡ������������ڷ�����
`/opt/yueji/shared/runtime.env` �� `backend.env`��Ȩ��Ϊ `600`�������ύ�� Git��

## ����

�������״β���ʱ�ϴ� `compose.yml`��`nginx.conf` �� `bootstrap.sh`������ root ���У�

```bash
bash /root/yueji-bootstrap.sh
```

�ű���У�������ֿ�������ύ����װ��У�� Node 22������ǰ��ˡ���������������
���� MinIO ����Ͱ����װ `yueji-backend.service`���״�����ʱ MySQL �ᰴ�׶� 0�C8E
˳���ʼ��������������ҵ�����ݣ��������������ظ�ִ�г�ʼ�� SQL��

���ü�飺

```bash
systemctl status yueji-backend.service
docker compose --env-file /opt/yueji/shared/runtime.env -f /opt/yueji/current/compose.yml ps
curl --fail http://127.0.0.1/healthz
```

��ǰ��˵�΢��֧����������ռλʵ�֡�`PAYMENT_DRIVER=wechat` �ɱ�֤������������ʹ�� Mock
֧��������ʵ֧�������ڲ���΢��֧��ʵ�ֺ��̻����ú���ܿ��š�

## GitHub Actions �Զ�����

���䱾Ŀ¼ bootstrap ���������в��֣�Nginx / MySQL / Redis / MinIO ʹ�� Compose��
NestJS ʹ�� `yueji-backend.service`�������������� bootstrap���������ݿ�������ִ�� SQL �򸲸���������������
������л��������� Ubuntu 22.04 ����µ� x86_64��ʹ�� `/opt/node-v22.23.2/bin/node`��
��ʵ�ʷ�������˲��ֲ�һ�£�`check` ��ʧ�ܣ�Ӧ�Ⱥ˶Է�����������������顣

### һ��������

�� **�����ֿ�**�� Settings �� Environments ���� `production`�������֧������ `master`��
�˰汾�����״β���� root ����Ȩ�ޣ�������Կ���Թ�����̨������������������ά�����޸�������֧��
���� `production` ���� required reviewers��ʹ��ר�� SSH ��Կ����Ҫ���ø�������Կ��
��Կ���Ȱ�װ�������� root �� `authorized_keys`��˽Կֻ��д�� GitHub Environment secrets��������������ύ���롣

| Environment secret | ���� |
| --- | --- |
| `DEPLOY_HOST` | ������ IP ������ |
| `DEPLOY_USER` | ��ǰ�汾Ҫ�� `root` |
| `DEPLOY_SSH_KEY` | ר�ò��� SSH ˽Կȫ�� |
| `DEPLOY_KNOWN_HOSTS` | ������� SSH ������Կ��¼����ʽ�� OpenSSH known_hosts һ�� |

�ֿ���� `DEPLOY_PORT` Ĭ�� `22`����Ҫ�ر�������Կ��飻��Ĭ�϶˿ڵļ�¼���� `[����]:�˿� ssh-ed25519 ��Կ`��
���ڰ����ƿ���Զ���ն˶�ȡ `/etc/ssh/ssh_host_ed25519_key.pub` �Ĺ�Կ������ǰ�油�����������ֶΣ���Ҫ��ȡ����˽Կ��
GitHub �й���������Ҫ�����ӷ����� SSH �˿ڡ��ֿ���� `AUTO_DEPLOY` ��ʼ����δ���á�

### �״��������ճ�ʹ��

1. ��˸Ķ��ϲ��� `master`���ٺϲ�ǰ�˸Ķ���ǰ����ˮ�߹̶����ú�˵��Ѻ����ύ��
2. ���ֿ� Actions �� **Aliyun release** �� **Run workflow**��ѡ�� `master` �� `check`��
3. ���ͨ����ѡ�� `deploy`����������ִ�� lint��������е��⡢����������ƺ͹�����ǰ�˹����Դ����ͼ�顣
4. �����ɹ���˶Ե�¼�͹ؼ�ҳ�棬�ٰѶ�Ӧ�ֿ�� **repository variable** `AUTO_DEPLOY` ����Ϊ `true`��
   �˺����� `master` �Զ������òֿ⣻�������� reviewer ������Ȼ��Ч��
5. ����ʧ�᳢ܻ�Իָ�ԭ�汾�������� Actions ʧ��״̬���ֶ�ѡ�� `rollback` ���л���һ�ɹ��汾������Ҫ���¹�����

��ǰֻ�����������̣�û�д�����Ŀ������ʵ�ʷ������﷨���ͨ���������״�������֤ͨ����
���� lint����������������ʧ�ܣ����޸�������ٷ��������Զ�����ʧ�ܡ�
ǰ�����޲ֿ��Դ����Զ������׼���������������鲻�����ҵ�����ա�

������ SSH ����������� job������ƾ�ݽ��ڲ�����ע�롣��Ʒ���� SSH ����У���� SHA-256 ������У�顣
��˴�� `dist`������������ `package.json`��ǰ��ֻ��� `dist`������������װ����������
�����ֿ�ʹ��ͬһ�����������и��£����������в�Ҫ�ֶ�ȡ������������˻��ؽ� Nginx ʱ���ж����жϣ�
�÷������ṩ��ͣ�����Զ��ع������ָ�����ʧ�ܻ���ȷ��� `RESTORE FAILED`��

### ������״̬��ָ�

- ԭʼ����Ŀ¼�� `/opt/yueji/current` ������
- ��Ӧ�ð汾���� `/opt/yueji/ci-releases/admin/` �� `backend/`��
- ������ֻ���� `/opt/yueji/shared/ci-admin.override.yml` �ľ�̬�ļ����ء�
- ���ֻ���� `/etc/systemd/system/yueji-backend.service.d/90-ci-release.conf` �Ĺ���Ŀ¼��
- ��һ�汾���ñ����� `/opt/yueji/shared/ci-admin/`��`ci-backend/`��`rollback` �ύ����ǰ����һ�档
- �ع����������ݿ��������������̴Ӳ��Զ�ִ�����ݿ�Ǩ�ơ�
- �汾Ŀ¼�������ڻع������̲�������л�ǰ��ֹ������ʱ������ǰ����һ�汾��ԭʼ bootstrap Ŀ¼��

�������ֹ�ִ�� Compose ʱ������������ɵĸ����ļ��������ص�ԭʼǰ�˹��أ�

```bash
docker compose --env-file /opt/yueji/shared/runtime.env \
  -f /opt/yueji/current/compose.yml \
  -f /opt/yueji/shared/ci-admin.override.yml ps
```

�ο���[GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)��
[��������](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)��
