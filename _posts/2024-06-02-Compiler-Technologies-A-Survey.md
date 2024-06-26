---
layout: "Post: Standard"
title: "Compiler Technologies in Deep Learning Co-Design: A Survey"
date: 2024-06-02 23:52
categories:
  - AI
tags:
  - Compiler
---

* content
{:toc}


# 标题
![](/wjq-China.github.io/assets/images/06-02/title.png)

从标题可以看出，这篇文章是一个综述，内容上主要是关于深度学习中的编译器技术。**Co-Design** 可以理解为**软硬件协同设计**，它可以包括：
1. 硬件设计：开发专用集成电路（ASIC）或张量处理单元（TPU）等硬件来加速深度学习计算。
2. 软件设计：开发和优化深度学习模型、算法以及编译器技术，充分利用硬件的性能。

直白点来说，就是在深度学习模型推理领域，设计硬件时要考虑软件（设计硬件时要考虑算法是怎么做的等等），设计软件时要考虑硬件（设计编译器时要考虑指令在硬件平台上是如何计算的等等），以达到硬件和算法最佳表现。

# 摘要
深度学习的应用飞速在发展，但是在硬件方面因为摩尔定律的失效导致通用的处理器无法满足深度学习模型的需求，因此需要专用的硬件来加速深度学习计算。本文详细阐述了过去有关深度学习中编译器以及协同设计的工作。 最后，作者针对典型的深度学习协同设计系统提出了一种特定领域的编译框架——Buddy Compiler。

# 引言
通用处理器无法满足深度学习任务的性能和功耗要求。因此，工业界和学术界都致力于软硬件协同设计，在这个过程中，编译器技术是非常重要的一个环节。

在深度学习软硬件协同设计中，硬件架构的创新是根本，软件设计（算法）是关键，从软件到硬件的映射决定了效果。深度学习系统负责映射和优化，这个过程分为模型级优化、工作负载优化和工作负载映射和硬件接口。为了获得更高的性能，需要在整个过程中进行调整，这对于协同设计至关重要。**在实践中，最直接的调优方法是与软硬件团队沟通确定需求。**

随着当前深度学习框架和硬件平台的碎片化（意思就是上有各种各样的深度学习框架，下游有各种各样的硬件平台——LPU,TPU,GPU...），编译技术可以在协同设计中发挥关键作用，以避免组合爆炸问题（M中深度学习框架，N中硬件平台，那么组合起来就是MxN中解决方案）。**编译技术的本质是抽象，软件和硬件的抽象正在走向统一的IR。**

这篇文章的主要贡献如下：
* 概述了深度学习软件、硬件、协同设计和系统的发展。
* 总结了深度学习协同设计系统的关键技术。
* 从软件和硬件两个角度对协同设计中编译技术进行了分析。
* 讨论了协同设计中编译技术的当前问题和未来趋势。
* 提出了一种特定领域的编译框架——Buddy Compiler。

# 背景

## 深度学习软件和硬件的发展
这部分主要介绍了从1960年开始到深度学习软件和硬件的发展历程，可以用下面这张图概括：

![](/wjq-China.github.io/assets/images/06-02/development_of_software_and_hardware.png)

在2000年后，Dennard Scaling（丹纳德缩放定律）开始失效。然后人们引入了多核设计，虽然多核的设计没有直接解决功耗问题，但是它通过引入更多的并行度进一步提高了性能，然后深度学习任务本身就有很高的并行性，所以两者刚好对应上。
> **丹纳德缩放定律：**在一个集成电路上，当晶体管的尺寸缩小时，他们在芯片上的密度增加，使得在相同面积的芯片上可以容纳更多的京替换；晶体管尺寸缩小的同时，电压和电流也按比例缩小，以保持功率密度恒定，尽管功率密度保持恒定，更多的晶体管意味着更高的性能和更强的计算能力，这个定律是由Robert H. Dennard在1974年提出的。然而，Dennard Scaling并不是无限制地有效，当晶体管变得非常小时，漏电流增加，导致功耗增加；电压降低到一定程度后，进一步降低电压变得困难，这限制了功率密度的控制；尽管功率密度保持恒定，但整体功耗增加，导致散热问题变得更为严重。


## 不同时期的协同设计

软硬件协同设计是一种硬件和软件的联合设计方法，以实现协同并满足系统约束，例如性能和功耗。如上图所示：在神经网络的早期兴起和衰落过程中，软件和硬件是交替发展的。到了2010年代，深度学习的硬件和软件开始协同设计，为广泛的协同设计提供了机会。协同设计的范围很大，在不同时期和领域提出了各种方法，**软硬件协同设计大约有30年的历史。**

## 深度学习协同设计系统

深度学习系统可以帮助开发者减小开销，在不同层级提供优化的机会。整个系统如下图所示：
![](/wjq-China.github.io/assets/images/06-02/deep_learning_systems.png)

包括了端到端的深度学习软件和硬件系统，硬件发展方法和协同设计技术。

###  神经网络架构设计和优化

神经网络架构优化可以减少模型的计算复杂度，常用的方法有设计高效的模型结构、剪枝、量化、硬件感知神经架构搜索等。除过这些，使用编译器技术的协同设计的方法可以获得更好的结果。

### 协同设计技术

我们相信协同设计的本质是在软件优化和硬件优化之间取得trade-off。在实际中，软件和硬件开发者需要理解对方的设计，高效沟通，一起做决定。根据我们的经验，通用的协同设计过程包括约束的指定，接口的设计，优化策略的迭代。
