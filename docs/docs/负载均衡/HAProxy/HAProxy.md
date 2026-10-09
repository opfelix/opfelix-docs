## 安装

[参考文档](https://www.cnblogs.com/leixixi/p/14749322.html)

```bash
systemctl disable firewalld && setenforce 0 && systemctl stop firewalld
yum install -y tar wget gcc make curl pcre-devel openssl-devel systemd-devel

curl -R -O http://www.lua.org/ftp/lua-5.4.6.tar.gz
tar zxf lua-5.4.6.tar.gz
cd lua-5.4.6
make all test
cd
wget  http://www.zlib.net/zlib-1.3.tar.gz
tar zxvf zlib-1.3.tar.gz
cd zlib-1.3
./configure && make && make install
cd
wget https://www.haproxy.org/download/2.8/src/haproxy-2.8.5.tar.gz
tar zxvf haproxy-2.8.5.tar.gz
cd haproxy-2.8.5.tar.gz
make ARCH=x86_64 TARGET=linux-glibc USE_PCRE=1 USE_OPENSSL=1 USE_ZLIB=1 USE_SYSTEMD=1 USE_LUA=1 LUA_INC=/root/lua-5.4.6/src LUA_LIB=/root/lua-5.4.6/src
make install PREFIX=/apps/haproxy
ln -s /apps/haproxy/sbin/haproxy /usr/sbin/

cat > /usr/lib/systemd/system/haproxy.service << EOF
[Unit]
Description=HAProxy Load Balancer
After=syslog.target network.target

[Service]
ExecStartPre=/usr/sbin/haproxy -f /etc/haproxy/haproxy.cfg -c -q
ExecStart=/usr/sbin/haproxy -Ws -f /etc/haproxy/haproxy.cfg -p /var/lib/haproxy/haproxy.pid
ExecReload=/bin/kill -USR2 $MAINPID
LimitNOFILE=100000

[Install]
WantedBy=multi-user.target

EOF

cat > /etc/haproxy/haproxy.cfg <<EOF
#--------------全局配置----------------
global
    maxconn 20480    # 每个haproxy进程的最大并发连接数
    #chroot /usr/local/haproxy
    chroot /apps/haproxy    # s锁定运行目录
    stats socket /var/lib/haproxy/haproxy.sock mode 600 level admin    # 指定socket的路径
    pidfile /var/run/haproxy.pid    # 指定pid文件路径
    # user, group, uid, gid运行haproxy的用户身份
    user haproxy
    group haproxy
    # uid 99
    # gid 99
    daemon
    # nbthread 1    # 指定haproxy进程开启的线程数,默认为每个进程一个线程
    # 和多进程nbproc配置互斥(版本有关),指定每个haproxy进程开启的线程数，默认为每个进程一个线程,如果同时启用nbproc和nbthread 会出现以下日志的错误，无法启动服务
    #nbproc 4    # 开启haproxy worker进程数,默认进程数是一个
    #cpu-map 1 0    # 绑定haproxy worker进程至指定CPU,将第1个work进程绑定至0号CPU 
    #cpu-map 2 1    # 绑定haproxy worker进程至指定CPU,将第2个work进程绑定至1号CPU 
    #cpu-map 3 2
    #cpu-map 4 3
    log 0.0.0.0 local{1-7} info    # 定义全局的syslog服务器,日志需要开启upd协议,最多可以定义两个, 级别有(err、warning、info、debug)
#---------------------------------------------------------------------
#common defaults that all the 'listen' and 'backend' sections will
#use if not designated in their block
#---------------------------------------------------------------------
defaults
    mode http|tcp    # 设置默认工作类型, 使用TCP服务器性能更好, 减少压力
    log global    # 开启当前web_prot的日志功能, 默认不记录日志
    option dontlognull
    option httpclose
    option httplog
    option http-keep-alive    # 开启与客户端的会话保持
    option forwardfor    # 透传客户端真实ip至后端服务器
    option redispatch    # 当server Id对应的服务器挂掉后，强制定向到其他健康的服务器，重新派发
    option abortonclose   # 当服务器负载很高时，自动结束掉当前队列处理比较久的连接，针对业务情况选择开启
    balance roundrobin
    timeout http-keep-alive 120s    # session 会话保持超时时间, 此时间段内会转发到相同的后端服务器
    timeout connect 10s    # 客户端请求从haproxy到后端server最长连接等待时间(TCP连接之前),默认单位ms
    timeout client 10s    # 设置haproxy与客户端的最长非活动时间, 默认单位ms, 建议和timeout server相同
    timeout server 10s    # 客户端请求从haproxy到后端服务端的请求处理超时时长(TCP连接之后), 默认单位ms, 如果超时, 会出现502错误, 此值建议设置较大些, 访止502错误
    timeout check 10s    # 对后端服务器的默认检测超时时间
    maxconn 60000
    retries 3
    default-server inter 1000 weight 3    # 指定后端服务器的默认设置
#--------------统计页面配置------------------
listen admin_stats
    bind 0.0.0.0:8888
    stats enable
    mode http
    log global
    stats uri /haproxy_stats
    stats realm Haproxy\ Statistics
    stats auth admin:admin
    #stats hide-version
    stats admin if TRUE
    stats refresh 30s
#--------------------主页----------------------
listen WEB_index
    bind :80
    mode http
    log global
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
EOF

systemctl daemon-reload
systemctl start haproxy && systemctl enable haproxy
sed -i s#SELINUX=enforcing#SELINUX=disabled# /etc/selinux/config && reboot

  
#通过配置文件启动, 可以进行排错
haproxy -f /etc/haproxy/haproxy.cfg
```

### 测试

浏览器输入`curl ip:8888/haproxy_stats`输入用户名和密码
![](img/Pasted%20image%2020231213151456.png)

## 基础配置详情

HAProxy 的配置文件haproxy.cfg由两大部分组成，分别是global和proxies部分
### global：全局配置段

```bash
进程及安全配置相关参数
新能调整相关参数
Debug参数
```

### rsyslog配置_本地

在`/etc/rsyslog.conf`中写入下列代码

```bash
$ModLoad imudp
# 由于haproxy是基于udp方式发送日志消息的，因此我们需要加载支持udp协议的模块
$UDPServerRun 514
# rsyslog的udp服务器默认端口是514
local{1-7}.*                /var/log/haproxy/haproxy.log
# {1-7}和haproxy中的global的log保持一致, 这里就是定义haproxy日志存放的路径
```

写完之后重启这俩程序

```bash
systemctl restart rsyslog
systemctl restart haproxy
```

### 创建两个实验用的nginx虚拟机，并修改主页文件

```bash
cat > index.html << EOF
<p style="font-size:50px;">Nginx</p>
<p style="font-size:50px;">ip</p>
EOF

ansible Nginx主机ip -m copy -a 'src=index.html dest=/usr/share/nginx/html/index.html'
```

### proxies：代理配置段

[官方文档](http://docs.haproxy.org/2.8/configuration.html)

```bash
defaults [<name>]    # 默认配置项，针对以下的frontend、backend和listen生效，可以多个name也可以没有name
frontend <name>    # 前端servername，类似于Nginx的一个虚拟主机 server和LVS服务集群。
backend <name>    # 后端服务器组，等于nginx的upstream和LVS中的RS服务器
listen <name>    # 将frontend和backend合并在一起配置，相对于frontend和backend配置更简洁，生产常用

注意: name字段只能使用大小写字母,数字,'-' (dash), '_' (underscore) , '.' (dot) and ':' (colon)并且严格区分大小写
```
![](img/Pasted%20image%2020231217160611.png)

#### server配置

```bash
# 针对一个server配置
check    # 对指定real进行健康状态检查, 如果不加此设置, 默认不开启检查, 只有check后面没有其它配置也可以启用检查功能, 默认对相应的后端服务器IP和端口, 利用TCP连接进行周期性健康性检查, 注意必须指定端口才能实现健康性检查

addr <IP>    # 可指定的健康状态监测IP, 可以是专门的数据网段, 减少业务网络的流量
port <num>    # 指定的健康状态监测端口
inter <num>    # 健康状态检查间隔时间, 默认2000 ms
fall <num>    # 后端服务器从线上转为线下的检查的连续失效次数, 默认为3
rise <num>    # 后端服务器从下线恢复上线的检查的连续有效次数, 默认为2

weight <weight>    # 默认为1, 最大值为256, 0(状态为蓝色)表示不参与负载均衡, 但仍接受持久连接
backup    # 将后端服务器标记为备份状态, 只在所有非备份主机down机时提供服务, 类似Sorry Server
disabled    # 将后端服务器标记为不可用状态, 即维护状态, 除了持久模式, 将不再接受连接, 状态为深黄色, 优雅下线, 不再接受新用户的请求

redirect prefix http://www.baidu.com/    # 将请求临时(302)重定向至其它URL, 只适用于http模式
redir http://www.baidu.com    # 将请求临时(302)重定向至其它URL,, 只适用于http模式
maxconn <maxconn>    # 当前后端server的最大并发连接数
```

#### Proxies配置-listen简化配置

使用`lesten`替换`frontend`和`backend`的配置方式，可以简化配置，通用只用于tcp协议的应用
```bash
listen WEB_index
    bind :80
    mode http
    log global
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

#### Proxies配置-frontend

##### frontend配置参数

```bash
bind:    # 指定HAProxy的监听地址, 可以是IPV4或IPV6, 可以同时监听多个IP或端口, 可同时用于listen字段中
# 格式
bind [<address>]:<port_range> [, ...] [param*]
#注意: 如果需要绑定在非本机的IP, 需要开启内核参数: net.ipv4.ip_nonlocal_bind=1

backlog <backlog>    # 针对所有server配置, 当前端服务器的连接数达到上限后的后援队列长度, 注意: 不支持backend
```

#### Proxies配置-backend

定义一组后端服务器，给frontend进行调用
注意：`backend`的名称必须唯一，并且必须在`listen`或`frontend`中事先定义才可以使用，否则服务无法启动

```bash
mode http|tcp    # 指定负载协议类型, 和对应的frontend必须一致
option    # 配置选项
server    # 定义后端real server, 必须指定IP和端口
```
注意：`option`后面加 `httpchk`、`smtpchk`、`mysql-check`、`pgsql-check`、`ssl-hello-chk`方法，可用于实现更多应用层检测功能

#### frontend+backend配置案例

```bash
frontend Nginx_index_port
    bind :80
    mode http
    use_backend  Nginx_index

backend Nginx_index
    mode http
    log global
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

## HAProxy调度算法

HAProxy通过固定参数`balance`指明对后端服务器的调度算法，该参数可以配置在`listen`或`backend`选项中
HAProxy的调度算法分为静态和动态调度算法，但是有些算法可以根据参数在静态和动态算法中相互转换

### 静态算法

静态算法：按照事先定义好的规则轮询公平调度，不关心后端服务器的当前负载、连接数和响应速等，且无法实时修改权重(只能为0和1,不支持其它值)，只能靠重启HAProxy生效

#### socat工具
对服务器动态权重和其它状态可以利用 socat工具进行调整，`Socat` 是 Linux 下的一个多功能的网络具，名字来由是`Socket CAT`，相当于`netCAT`的增强版`.Socat` 的主要特点就是在两个数据流之间建立双向通道，且支持众多协议和链接方式。如 `IP`、`CP`、 `UDP`、`IPv6`、`Socket`文件等

```bash
yum install -y socat    # 安装

socat -h    # 帮助
echo "help" | socat stdio /var/lib/haproxy/haproxy.sock    # 查看haproxy的匹配或所有命令
echo "show info" | socat stdio /var/lib/haproxy/haproxy.sock    # 查看haproxy正在运行的进程的信息
echo "show servers state" | socat stdio /var/lib/haproxy/haproxy.sock    # 转储易失性服务器信息（全部或单个后端）

echo "get weight WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock    # 显示服务器的weight
echo "set weight WEB_index/web1 2" | socat stdio /var/lib/haproxy/haproxy.sock    # 修改weight，注意只针对单进程有效
echo "get weight WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock
2 (initial 3)

echo "disable server WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock    # 将后端服务器禁用，注意只针对单进程有效
echo "enable server WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock    # 启用后端服务器
echo "set weight WEB_index/web1 0" | socat stdio /var/lib/haproxy/haproxy.sock    # 将后端服务器软下线，即weight设为0

#针对haproxy的多进程,将后端服务器禁用
vim /etc/haproxy/haproxy.cfg
......
stats socket /var/lib/haproxy/haproxy1.sock mode 600 level admin process 1 #绑定第
1个进程和socket文件
stats socket /var/lib/haproxy/haproxy2.sock mode 600 level admin process 2 #绑定第
2个进程和socket文件
nbproc 2
.....
echo "disable server WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy1.sock
echo "disable server WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy2.sock

for i in {1..2};do echo "set weight WEB_index/web$i 10" | socat stdio /var/lib/haproxy/haproxy$i.sock;done

# 如果静态算法, 如: static-rr，可以更改weight为0或1, 但不支持动态更改weight为其它值, 否则会提示下面信息
echo "set weight WEB_index/web1 0" | socat stdio /var/lib/haproxy/haproxy.sock
echo "set weight WEB_index/web1 1" | socat stdio /var/lib/haproxy/haproxy.sock
echo "set weight WEB_index/web1 2" | socat stdio /var/lib/haproxy/haproxy.sock
Backend is using a static LB algorithm and only accepts weights '0%' and '100%'
```

### static-rr

基于权重的轮询调度，不支持运行时利用socat进行除`0`和`1`之外的权重进行调整及后端服务器慢启动，其后端主机数量没有显示，相当于LVS的wrr

```bash
listen WEB_index
    bind :80
    mode http
    log global
    balance static-rr
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5 
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

### first

根据服务器在列表中的位置，自上而下进行调度，但是其只会当第一台服务器的连接数达到上限，新请求才会分配给下一台服务，因此会忽略服务器的权重设置，此方式使用较少
不支持运行时利用socat进行除`0`和`1`之外的权重进行调整

### 动态算法

动态算法：基于后端服务器状态进行调度适当调整，新请求将优先调度至当前负载较低的服务器，且权
重可以在haproxy运行时动态调整无需重启

#### roundrobin

- 基于权重的轮询动态调度算法，支持权重的运行时调整，不同于`lvs`中的`rr`轮训模式
- HAProxy中的`roundrobin`支持慢启动(新加的服务器会逐渐增加转发数)，其每个后端`backend`中最多支持4095个`real server`，支持对`real server`权重动态调整
- roundrobin为默认调度算法,此算法使用广泛
```bash
listen WEB_index
    bind :80
    mode http
    log global
    balance roundrobin
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
    
echo "get weight WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock
3 (initial 3)
echo "set weight WEB_index/web1 2" | socat stdio /var/lib/haproxy/haproxy.sock
echo "get weight WEB_index/web1" | socat stdio /var/lib/haproxy/haproxy.sock
2 (initial 3)
```

#### leastconn

- leastconn加权的最少连接的动态
- 支持权重的运行时调整和慢启动，即根据当前连接最少的后端服务器而非权重进行优先调度(新客户端连接)
- 比较适合长连接的场景使用，比如：MySQL等场景
```bash
listen WEB_index
    bind :80
    mode http
    log global
    balance leastconn
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

#### random

- 在1.9版本开始增加`random`的负载平衡算法
- 基于随机数作为一致性`hash`的`key`
- 随机负载平衡对于大型服务器场或经常添加或删除服务器非常有用
- 支持`weight`的动态调整，`weight`较大的主机有更大概率获取新请求
```bash
listen WEB_index
    bind :80
    mode http
    log global
    balance random
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

### 其他算法

既可以作为静态算法，又可以通过选项称为动态算法

#### source

- 源地址hash，基于用户源地址hash并将请求转发到后端服务器，后续同一个源地址请求将被转发至同一个后端web服务器
- 此方式当后端服务器数据量发生变化时，会导致很多用户的请求转发至新的后端服务器
- 默认为**静态方式**，但是可以通过hash-type支持的选项更改
- 这个算法一般是在不插入Cookie的TCP模式下使用，也可给拒绝会话cookie的客户提供最好的会话粘性，适用于session会话保持但不支持cookie和缓存的场景
- 源地址有两种转发客户端请求到后端服务器的服务器选取计算方式，分别是取模法和一致性hash

#### map-base取模法

- 对source地址进行hash计算，再基于服务器总权重的取模，最终结果决定将此请求转发至对应的后端服务器
- 此方法是**静态**的，即不支持在线调整权重，不支持慢启动，可实现对后端服务器均衡调度
- 缺点是当服务器的总权重发生变化时，即有服务器上线或下线，都会因总权重发生变化而导致调度结果整体改变，hash-type指定的默认值为此算法

```bash
所谓取模运算，就是计算两个数相除之后的余数，10%7=3, 7%4=3
map-based算法：基于权重取模，hash(source_ip)%所有后端服务器相加的总权重

listen WEB_index
    bind :80
    mode http
    log global
    hash-type map-based
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

#不支持动态调整权重值
echo "set weight WEB_index/ip 10" | socat stdio /var/lib/haproxy/haproxy.sock
Backend is using a static LB algorithm and only accepts weights '0%' and '100%'.
#只能动态上线和下线
echo "set weight WEB_index/ip 0" | socat stdio /var/lib/haproxy/haproxy.sock
echo "get weight WEB_index/ip" | socat stdio /var/lib/haproxy/haproxy.sock
0 (initial 1)
```

#### 一致性hash

当服务器的总权重发生变化时，对调度结果影响是局部的，不会引起大的变动，`hash（o）mod n`，支持使用 socat等工具进行在线权重调整，支持慢启动，该hash算法是动态的

```bash
# 算法
1、key1=hash(source_ip)%(2^32) [0---4294967295]
2、keyA=hash(后端服务器虚拟ip)%(2^32)
3、将key1和keyA都放在hash环上，将用户请求调度到离key1最近的keyA对应的后端服务器

# hash环偏斜问题
增加虚拟服务器IP数量，比如：一个后端服务器根据权重为1生成1000个虚拟IP，再hash。而后端服务器权
重为2则生成2000的虚拟IP，再bash,最终在hash环上生成3000个节点，从而解决hash环偏斜问题
```

##### hash对象

hash对象到后端服务器的映射关系

![](img/Pasted%20image%2020231225222117.png)

##### 一致性hash示意图

后端服务器在线与离线的调度方式

![](img/Pasted%20image%2020231225222310.png)

```bash

listen WEB_index
    bind :80
    mode http
    log global
    balance source
    hash-type consistent
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5
```

#### uri

基于对用户请求的`URI`的左半部分或整个`uri`做`hash`，再将`hash`结果对总权重进行取模后，根据最终结果将请求转发到后端指定服务器，适用于后端是缓存服务器场景
默认是静态算法，也可以通过`hash-type`指定`map-based`和`consistent`，来定义使用取模法还是一致性`hash`
**注意：此算法基于应用层，所以只支持 mode http ，不支持 mode tcp**
```text
<scheme>://<user>:<password>@<host>:<port>/<path>;<params>?<query>#<frag>
左半部分：/<path>;<params>
整个uri：/<path>;<params>?<query>#<frag>
```

```bash
# uri取模法配置示例
listen WEB_index
    bind :80
    mode http
    log global
    balance uri
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# uri一致性hash配置示例
listen WEB_index
    bind :80
    mode http
    log global
    balance uri
    hash-type consistent
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# 访问测试
```

#### url_param

- `url_param`对用户请求的`url`中的`params`部分中的一个参数`key`对应的`value`值作`hash`计算，并由服务器总权重相除以后派发至某挑出的服务器
- 通常用于追踪用户，以确保来自同一个用户的请求始终发往同一个`real server`
- 如果无没`key`，将按`roundrobin`算法
```bash
# 假设
url = http://www.xxx.com/foo/bar/index.php?key=value
# 则
host = "www.xxx.com"
url_param = "key=value"
```

```bash
# url_param取模法配置示例
listen WEB_index
    bind :80
    mode http
    log global
    balance url_param userid    # url_param hash
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# url_param一致性hash配置示例
listen WEB_index
    bind :80
    mode http
    log global
	balance url_param userid    # 对url_param的值取hash
	hash-type consistent
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# 测试访问

curl http://ip/index.html?userid=<NAME_ID>
curl "http://ip/index.html?userid=<NAME_ID>&typeid=<TYPE_ID>"
```

#### hdr

针对用户每个http头部(header)请求中的指定信息做hash，此处由 name 指定的http首部将会被取出并做hash计算，然后由服务器总权重取模以后派发至某挑出的服务器，如果无有效值，则会使用默认的轮询调度

```bash
# hdr取模法配置示例
listen WEB_index
    bind :80
    mode http
    log global
	balance hdr(User-Agent)
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# 一致hash配置示例
listen WEB_index
    bind :80
    mode http
    log global
	balance hdr(User-Agent)
	hash-type consistent
    server web1 192.168.100.14:80 check inter 3000 fall 3 rise 5
    server web2 192.168.100.4:80 check inter 3000 fall 3 rise 5

# 测试访问
curl -v http://ip/index.html
curl -vA 'firefox' http://ip/index.html
curl -vA 'chrome' http://ip/index.html
```

#### rdp-cookir

`rdp-cookie`对远`windows`远程桌面的负载，使用`cookie`保持会话，**默认是静态**，也可以通过`hash-type`，指定`map-based`和`consistent`，来定义使用取模法还是一致性`hash`

```bash
listen RDP
    bind :3389
    balance rdp-cookie
    mode tcp 
    server rdp0 192.168.100.19:3389 check fall 3 rise 5 inter 2000 weight 1

hostname -I
10.10.0.7    172.16.0.100
```

#### 基于iptables实现RDP协议转发

必须开启ip转发功能：`net.ipv4.ip_forward = 1`

```bash
sysctl -w net.ipv4.ip_forward=1    # 客户端和Windows在不同网段需要下面命令,注意后端服务器需要将iptables主机配置为网关
iptables -t nat -A PREROUTING -d 172.16.0.100 -p tcp --dport 3389 -j DNAT --to-destination 192.168.100.200:3389    # 客户端和Windows在同一网段需要再执行下面命令
iptables -t nat -A PREROUTING -d 10.0.0.8 -p tcp --dport 3389 -j DNAT --to-destination 10.0.0.1:3389
iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j SNAT --to-source 10.0.0.8
```

#### 算法总结

```bash
#静态
static-rr--------->tcp/http
first------------->tcp/http

#动态
roundrobin-------->tcp/http
leastconn--------->tcp/http
random------------>tcp/http

#以下静态和动态取决于hash_type是否consistent
source------------>tcp/http
Uri--------------->http
url_param--------->http
hdr--------------->http
rdp-cookie-------->tcp
```

#### 应用场景

```bash
first    # 使用较少

static-rr    # 做了session共享的web集群
roundrobin
random

leastconn    # 数据库
source    # 基于客户端公网IP的会话保持

Uri--------------->http    # 缓存服务器，CDN服务商，蓝汛、百度、阿里云、腾讯
url_param--------->http    # 可以实现session保持

hdr    # 基于客户端请求报文头部做下一步处理
rdp-cookie    # 基于Windows主机,很少使用
```